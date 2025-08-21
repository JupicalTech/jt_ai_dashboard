from odoo import models, fields, api
import requests
import json
import re
from ..utils.langchain_utils import interpret_natural_prompt
from datetime import datetime, timedelta
from odoo.tools import float_round
from collections import Counter




class GroqPrompt(models.Model):
	_name = 'groq.prompt'
	_description = 'Groq AI Prompt'

	name = fields.Char("Prompt")
	response = fields.Text("Response")

	@staticmethod
	def is_count_request(prompt):
		"""Detect if the prompt is asking for a count/number."""
		count_keywords = ['number', 'no.', 'count', 'how many', 'total']
		return any(keyword in prompt.lower() for keyword in count_keywords)

	def parse_domain_dates(self, domain):
		"""Replace date('now', '-N days') with YYYY-MM-DD string."""
		def parse_date_expr(val):
			match = re.match(r"date\(['\"]now['\"],\s*['\"](-?\d+)\s*days['\"]\)", val)
			if match:
				days_offset = int(match.group(1))
				new_date = datetime.today() + timedelta(days=days_offset)
				return new_date.strftime("%Y-%m-%d")
			return val

		if isinstance(domain, list):
			new_domain = []
			for d in domain:
				if isinstance(d, list) and len(d) >= 3 and isinstance(d[2], str):
					d_copy = d.copy()
					d_copy[2] = parse_date_expr(d_copy[2])
					new_domain.append(d_copy)
				else:
					new_domain.append(d)
			return new_domain
		else:
			return domain

	def _summarize_common_skills(self, records):
		all_skill_ids = []
		for rec in records:
			all_skill_ids.extend(rec.get("skill_ids", []))

		if not all_skill_ids:
			return "No skills found among employees."

		skill_counter = Counter(all_skill_ids)
		top_skills = skill_counter.most_common(5)

		skills = self.env["hr.skill"].browse([s[0] for s in top_skills]).read(["id", "name"])
		id_to_name = {s["id"]: s["name"] for s in skills}

		result_lines = [f"{id_to_name.get(skill_id)} — {count} employees" for skill_id, count in top_skills]
		return "Most Common Skills:\n" + "\n".join(result_lines)

	def fetch_groq_response(self, prompt):
		try:
			print("Step 1: Prompt →", prompt)
			result = interpret_natural_prompt(prompt, self.env)
			print("LLM RAW OUTPUT:", result)

			# If it's already a list, we format and return
			if isinstance(result, list):
				formatted_response = "\n".join(
					[", ".join(str(i) for i in item) if isinstance(item, list) else str(item) for item in result]
				)
				self.env['jt.prompt.history'].create({
					'prompt': prompt,
					'response': formatted_response,
					'user_id': self.env.user.id,
				})
				return formatted_response

			# Step 2: Try parsing JSON response
			try:
				meta = json.loads(result)
			except Exception:
				meta_str = result.strip().replace("``````", "").replace("````", "").strip()
				try:
					meta = json.loads(meta_str)
				except Exception:
					return f"Error: Could not parse AI response.\nRaw Result:\n{result}"

			model_name = meta.get("model")
			domain = meta.get("domain", [])
			limit = meta.get("limit")
			order = meta.get("order")
			action = meta.get("action", "query")

			if not model_name:
				return "Error: Model not detected in the AI response."

			# Force ilike for name-based hr.employee queries
			if model_name == "hr.employee":
				for clause in domain:
					if isinstance(clause, list) and clause[0] == "name" and clause[1] == "=":
						clause[1] = "ilike"

			# Common skill-related prompt handling
			if model_name == "hr.employee" and re.search(r"(most|top|frequent|common)\s+(skills?|competencies?)", prompt, re.I):
				fields = ["skill_ids"]
				employees = self.fetch_odoo_data_from_model("hr.employee", fields, domain, limit=limit, order=order)
				return self._summarize_common_skills(employees)

			# Product-related dynamic field & domain handling
			product_related_models = ['product.product', 'product.template']
			most_sold_pattern = r'\b(most|top|highest|maximum|best|trending|trend)\b.*\b(sold|selling|sales|sale)\b'
			least_sold_pattern = r'\b(least|lowest|fewest|minimum)\b.*\b(sold|selling|sales|sale)\b'

			if model_name in product_related_models:
				if re.search(most_sold_pattern, prompt, re.I):
					fields = ['name', 'sales_count_cache', 'qty_available', 'list_price']
					order = 'sales_count_cache desc'
				elif re.search(least_sold_pattern, prompt, re.I):
					fields = ['name', 'sales_count_cache', 'qty_available', 'list_price']
					order = 'sales_count_cache asc'
				else:
					fields = ['name', 'qty_available', 'list_price']
				if re.search(r'location|warehouse|per location|each location', prompt, re.I):
					fields.append('all_location_quantities')
			else:
				fields = meta.get("fields", ["name"])

			# Stock level logic
			if model_name in product_related_models:
				prompt_lower = prompt.lower()
				if 'low stock' in prompt_lower:
					domain.append(['qty_available', '<', 10])
				elif 'high stock' in prompt_lower:
					domain.append(['qty_available', '>', 50])

			domain = self.parse_domain_dates(domain)
			odoo_data = self.fetch_odoo_data_from_model(model_name, fields, domain, prompt, limit, order)
			if isinstance(odoo_data, str) and odoo_data.startswith("Error"):
				formatted_response = odoo_data
			elif odoo_data:
				if action == "count" or self.is_count_request(prompt):
					label = model_name.replace(".", " ").title()
					formatted_response = f"Label,Value\n{label},{len(odoo_data)}"
				else:
					# Convert field technical names into user-friendly labels
					labels = [
						self.env[model_name]._fields[f].string if f in self.env[model_name]._fields else f
						for f in fields
					]
					header_row = ", ".join(labels)
					# header_row = ", ".join(fields)
					rows = []
					for record in odoo_data:
						row = []
						for f in fields:
							val = record.get(f, '')
							# Handle Many2one values
							if isinstance(val, tuple) and len(val) >= 2:
								val = val[1]
								# If it's like "YourCompany, Joel Willis", take last part
								if "," in val:
									val = val.split(",")[-1].strip()
							elif isinstance(val, str) and "," in val and f.endswith("_id"):
								# Sometimes Odoo gives a display_name string like "YourCompany, Joel Willis"
								# Take only the last part after the comma, i.e. the actual contact name
								val = val.split(",")[-1].strip()

							row.append(str(val))
						rows.append(", ".join(row))

					formatted_response = header_row + "\n" + "\n".join(rows)
			else:
				formatted_response = "No Matching Records Found"

			print("FORMATTED FINAL RESPONSE:\n", formatted_response)
			self.env['jt.prompt.history'].create({
				'prompt': prompt,
				'response': formatted_response,
				'user_id': self.env.user.id,
			})
			return formatted_response

		except Exception as e:
			print("❗ UNHANDLED ERROR in fetch_groq_response():", str(e))
			return f"Error in AI processing: {e}"

	
	def fetch_odoo_data_from_model(self, model_name, fields, domain, prompt=None, limit=None, order=None):
		try:
			# 1. NLP → Technical Model Mapping
			model_mapping = {
				"customers": "res.partner", "customer": "res.partner", "partner": "res.partner", "partners": "res.partner",
				"sale": "sale.order", "sales": "sale.order", "order": "sale.order", "orders": "sale.order",
				"sale order": "sale.order", "sale orders": "sale.order", "sales order": "sale.order",
				"sales orders": "sale.order", "quotation": "sale.order", "quotations": "sale.order",
				"quote": "sale.order", "quotes": "sale.order",
				"sale order line": "sale.order.line", "sale order lines": "sale.order.line",
				"order line": "sale.order.line", "order lines": "sale.order.line",
				"purchase": "purchase.order", "purchases": "purchase.order", "purchase order": "purchase.order",
				"purchase orders": "purchase.order", "rfq": "purchase.order", "rfqs": "purchase.order",
				"purchase order line": "purchase.order.line", "purchase order lines": "purchase.order.line",
				"invoice": "account.move", "invoices": "account.move", "bill": "account.move", "bills": "account.move",
				"employee": "hr.employee", "employees": "hr.employee", "staff": "hr.employee",
			}

			# 2. Normalize model name
			model_name_clean = model_mapping.get(model_name.lower().strip(), model_name)
			if model_name_clean not in self.env:
				return f"Error: Model '{model_name_clean}' not found in Odoo."
			model_name = model_name_clean

			# 3. Normalize domain filters
			CUSTOMER_FIELDS = {
				"customer", "customer_name", "partner", "partner_name", "vendor", "vendor_name",
				"supplier", "supplier_name", "client", "client_name", "company", "company_name"
			}
			PRODUCT_FIELDS = {"product", "product_name", "product_id", "item", "item_name"}

			for d in domain:
				if not (isinstance(d, list) and len(d) == 3):
					continue
				field, op, value = d
				if field == "order_partner_id":
					d[0] = "order_id.partner_id.name"
					d[1] = "ilike"
				elif field in CUSTOMER_FIELDS:
					d[0] = "order_id.partner_id.name" if model_name == "sale.order.line" else "partner_id.name"
					d[1] = "ilike"
				elif field == "partner_id":
					d[0] = "partner_id.name"
					d[1] = "ilike"
				elif field in PRODUCT_FIELDS:
					d[0] = "product_id.name" if model_name.endswith(".line") else "partner_id.name"
					d[1] = "ilike"

			# 4. Special handling for quotations
			if model_name == "sale.order" and prompt:
				if "quotation" in prompt.lower() or "quote" in prompt.lower():
					domain.append(["state", "=", "draft"])

			# 5. Default domain for customer model
			if model_name == "res.partner":
				domain = [["customer_rank", ">", 0]]

			# 6. Field sanitization
			valid_fields = self.env[model_name]._fields
			fields = [f for f in fields if f in valid_fields]
			if not fields:
				fields = ["name"]

			# Aliasing (e.g., qty_ordered → product_uom_qty)
			fields = [f.replace("qty_ordered", "product_uom_qty") for f in fields]

			# 7. Search kwargs
			search_kwargs = {"limit": int(limit)} if limit else {}
			if order:
				search_kwargs["order"] = order

			# 8. ORM Query
			model = self.env[model_name]
			print("Model:", model_name)
			print("Domain:", domain)
			print("Fields:", fields)
			print("Search Kwargs:", search_kwargs)

			records = model.search_read(domain, fields, **search_kwargs)
			print(" Records Fetched:", len(records))

			# Handle skill_ids manually and resolve skill names without overwriting IDs
			if model_name == "hr.employee" and "skill_ids" in fields:
				all_skill_ids = []

				# Normalize skill_ids to a clean list of integers
				for rec in records:
					raw_ids = rec.get("skill_ids", [])

					if isinstance(raw_ids, str):
						# Parse comma-separated string safely to int list
						try:
							normalized = [int(s.strip()) for s in raw_ids.split(",") if s.strip().isdigit()]
						except Exception:
							normalized = []
					elif isinstance(raw_ids, list):
						# If list of tuples like (id, name), extract the ids
						if all(isinstance(i, tuple) and len(i) == 2 for i in raw_ids):
							normalized = [i[0] for i in raw_ids if isinstance(i[0], int)]
						else:
							# Assume list of ints, filter invalid types
							normalized = [i for i in raw_ids if isinstance(i, int)]
					else:
						normalized = []

					rec["skill_ids"] = normalized  # Always keep skill_ids as list[int]
					all_skill_ids.extend(normalized)

				# Fetch skill names for all unique skill IDs
				if all_skill_ids:
					Skill = self.env["hr.skill"]
					unique_skill_ids = list(set(all_skill_ids))
					skills = Skill.browse(unique_skill_ids).read(["id", "name"])
					skill_map = {s["id"]: s["name"] for s in skills}

					# Add display fields without changing skill_ids
					for rec in records:
						skill_names = [skill_map.get(sid, f"ID {sid}") for sid in rec.get("skill_ids", []) if isinstance(sid, int)]
						rec["skill_names"] = skill_names                          # List of skill names
						rec["skill_names_str"] = ", ".join(skill_names)           # Comma-separated string of skill names
						# ⚠️ Do NOT modify rec["skill_ids"]
			return records

		except Exception as e:
			return f"Error fetching Odoo data: {str(e)}"


	def action_ask_ai(self):
		for record in self:
			prompt_text = (record.name or "").strip()
			if prompt_text:
				try:
					from odoo.addons.jt_ai_dashboard.langchain_utils import fetch_groq_response
					record.response = fetch_groq_response(prompt_text)
				except Exception as e:
					record.response = f"An error occurred: {str(e)}"
			else:
				record.response = "Please provide a valid prompt before asking JT AI."

	@api.model
	def create(self, vals):
		prompt = vals.get("name")
		if prompt:
			response = self.fetch_groq_response(prompt)
			vals["response"] = response
		return super(GroqPrompt, self).create(vals)
