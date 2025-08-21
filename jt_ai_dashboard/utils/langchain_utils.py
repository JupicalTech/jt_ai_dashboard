# import os
# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_core.output_parsers import StrOutputParser
# from langchain_core.prompts import PromptTemplate
# import re
# import json

# # Set your Gemini API key -- best set via env var, not hardcoded!
# os.environ["GOOGLE_API_KEY"] = "AIzaSyD5rzjOO_eoinaVaRAstpk9Yh9Uy2L6wYQ"

# # Google Gemini (Gemini 1.5 Pro is currently the most capable, 1.0 Pro for lower cost)
# llm = ChatGoogleGenerativeAI(
#     model="models/gemini-1.5-flash",   # Or "models/gemini-1.0-pro-latest"
#     temperature=0.2
#     # google_api_key will be picked up from env by default
# )

# template = """
# You are an Odoo AI agent. Convert the user request into a JSON dict with these keys:
# - action: 'query' or 'count'
# - model: Odoo technical model name (e.g., 'sale.order')
# - fields: list of fields needed (use ['name', ...] as default)
# - domain: Odoo style search domain (can be empty [])
# - limit: integer limit if user asks for N records
# - order: field name and direction if sorting is required (e.g., 'date_order desc')
# If unsure on a key, make your best guess.

# User Prompt: {prompt}
# """

# prompt = PromptTemplate.from_template(template)
# chain = prompt | llm | StrOutputParser()

# def interpret_natural_prompt(prompt_text):
#     """
#     Returns raw AI output, then extracts JSON snippet from it.
#     Handles cases where Gemini wraps the JSON in explanation/code block/etc.
#     """
#     raw_output = chain.invoke({"prompt": prompt_text})

#     match = re.search(r"\{.*\}", raw_output, re.DOTALL)
#     if match:
#         return match.group(0)  # Just the JSON
#     else:
#         return raw_output.strip() 


import os
import re
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate

# Set your Gemini API Key via environment variable
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY", "AIzaSyD5rzjOO_eoinaVaRAstpk9Yh9Uy2L6wYQ")

# Model Selection
llm = ChatGoogleGenerativeAI(
    model="models/gemini-1.5-flash",
    temperature=0.2
)

# Prompt Template
template = """
You are an Odoo assistant. ONLY respond with valid JSON structured like this:

{{
    "action": "query | count",
    "model": "<model_name>",
    "fields": ["<field1>", "<field2>"],
    "domain": [["field", "operator", "value"]],
    "limit": 1000,
    "order": "<field_name> asc|desc"
}}

⚠️ No explanation.
⚠️ No markdown.
⚠️ Only return valid JSON response.

- Prefer stored fields like `sales_count_cache` for sorting.
- Avoid using non-stored fields unless explicitly required.

User Prompt: {prompt}
"""

prompt = PromptTemplate.from_template(template)
chain = prompt | llm | StrOutputParser()

def fetch_employee_experience(prompt, env):
    match = re.search(r"(?:experience of|how long has)\s+([a-zA-Z ]+)", prompt, re.IGNORECASE)
    if match:
        employee_name = match.group(1).strip()
        employee = env['hr.employee'].sudo().search([('name', 'ilike', employee_name)], limit=1)
        if employee:
            experience = employee.get_total_experience_years()
            return f"{employee.name} has {experience} of experience."
        else:
            return f"No employee found with name {employee_name}."
    return None


def interpret_natural_prompt(prompt_text,env):
    """
    Extracts and sanitizes JSON from LLM output.
    Handles bad formatting, code blocks, AI artifacts.
    Adds fallback logic for hardcoded trending/popular keywords.
    """

    # 1. Custom rules
    resp = fetch_employee_experience(prompt_text,env)
    if resp:
        return json.dumps([resp])

    # 2. Keyword-based fallback
    keyword_patterns = [
        r"\btrending\b",
        r"\bpopular\b",
        r"\bmost\s+sold\b",
        r"\btop\s+selling\b"
    ]
    if any(re.search(p, prompt_text.lower()) for p in keyword_patterns):
        parsed = {
            "action": "query",
            "model": "product.product",
            "fields": ["name", "sales_count_cache", "qty_available", "list_price"],
            "domain": [],
            "limit": 10,
            "order": "sales_count_cache desc"
        }
        return json.dumps(parsed)

    # 3. Send to LLM
    raw_output = chain.invoke({"prompt": prompt_text})
    print("🤖 LLM RAW OUTPUT:\n", raw_output)

    # 4. Clean output
    cleaned = raw_output.strip().replace("```", "").replace(" ", "")
    cleaned = cleaned.replace("False", "false").replace("True", "true").replace("None", "null")

    # 5. Extract JSON
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if not match:
        print("❌ No valid JSON found; returning raw content.")
        return cleaned

    json_str = match.group(0).strip()

    try:
        parsed = json.loads(json_str)

        # Adjust fields if necessary
        if parsed.get("model") in ("product.template", "product.product") and "sales_count" in parsed.get("order", ""):
            parsed["order"] = re.sub(r'(?<!_cache)\bsales_count\b', 'sales_count_cache', parsed["order"])
            parsed["model"] = "product.product"
            if "sales_count_cache" not in parsed.get("fields", []):
                parsed["fields"].append("sales_count_cache")

        return json.dumps(parsed)

    except json.JSONDecodeError as e:
        print("❌ JSON decode failed:", e)
        print("🪵 Unparseable JSON:\n", json_str)
        raise e



# version 3 need to create billing account & use gemini api so not using as of now

# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_core.prompts import PromptTemplate
# from langchain_core.output_parsers import JsonOutputParser
# from langchain_core.runnables import RunnablePassthrough

# # Gemini Model Setup
# llm = ChatGoogleGenerativeAI(
#     model="gemini-1.5-flash",
#     temperature=0.2,
#     convert_system_message_to_human=True,
# )

# # Output parser for valid JSON
# parser = JsonOutputParser()

# # Prompt Template
# template = """
# You are a backend developer for an ERP system like Odoo. Your job is to convert user queries in natural language into valid JSON search actions for Odoo's ORM API.

# Here is the format:
# {{
#     "action": "query",
#     "model": "<model_name>",
#     "fields": ["field1", "field2", ...],
#     "domain": [[<field>, <operator>, <value>], ...],
#     "limit": 1000,
#     "order": "<field> asc/desc"
# }}

# Instructions:
# - Always use `product.product` model if you need sales data.
# - Use the stored field `sales_count_cache` for sorting sold products.
# - Avoid using non-stored fields like `sales_count` or `sales_count_month`.
# - If the prompt includes "trending", "trend", or "popular", treat it as a request for most sold products and use `product.product` with `order: sales_count_cache desc`.
# - If no limit is given, default to 1000.
# - Return only valid JSON (no text before or after).
# - Include only fields relevant to the prompt (e.g., "name", "qty_available", "list_price", etc.)

# User Prompt:
# {prompt}
# """

# prompt = PromptTemplate(template=template, input_variables=["prompt"])

# # Main Chain
# chain = (
#     {"prompt": RunnablePassthrough()} 
#     | prompt 
#     | llm 
#     | parser
# )

# # Post-processing & Execution Function
# def interpret_natural_prompt(prompt_text):
#     parsed = chain.invoke(prompt_text)

#     # Fix field name from LLM error: sales_count_cache_cache
#     if "sales_count_cache_cache" in parsed.get("order", ""):
#         parsed["order"] = parsed["order"].replace("sales_count_cache_cache", "sales_count_cache")

#     # If sales_count is used in order clause, replace it with the stored field
#     if parsed["model"] in ("product.template", "product.product") and "sales_count" in parsed.get("order", ""):
#         parsed["order"] = parsed["order"].replace("sales_count", "sales_count_cache")
#         parsed["model"] = "product.product"
#         parsed["fields"] = list(set(parsed["fields"] + ["sales_count_cache"]))

#     return parsed

