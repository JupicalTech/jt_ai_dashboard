from odoo import models, fields, api
from odoo.tools import float_round
from datetime import datetime, timedelta
import os
import sys
import logging

_logger = logging.getLogger(__name__)

# Add parent directory to import langchain_utils
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.langchain_utils import interpret_natural_prompt  # ✅ Make sure this file exists

class ProductProduct(models.Model):
    _inherit = 'product.product'

    all_location_quantities = fields.Text(
        string="Stock at All Locations",
        compute='_compute_all_location_quantities',
        store=True
    )

    sales_count_cache = fields.Float(
        string="Total Units Sold",
        store=True,
        readonly=True
    )

    @api.depends('stock_quant_ids.quantity', 'stock_quant_ids.location_id')
    def _compute_all_location_quantities(self):
        for product in self:
            lines = []
            for quant in product.stock_quant_ids:
                qty = quant.quantity
                loc_name = quant.location_id.display_name
                if qty:  # Only show if there is stock (>0)
                    lines.append(f"{loc_name}: {qty}")
            product.all_location_quantities = '\n'.join(lines) if lines else 'No stock'

    def test_method(self):
        print("✅ test_method called")
        _logger.info("✅ test_method called on product: %s", self.name)
        print("🧠 jt_ai_dashboard.models.ai_dashboard LOADED")
        return "OK"

    @api.model
    def action_refresh_sales_count_cache(self, period_months=12):
        """
        Refresh 'sales_count_cache' using qty_delivered from sale.order.line.
        """
        date_from = (datetime.now() - timedelta(days=30 * period_months)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        all_products = self.search([])
        product_ids = all_products.ids

        domain = [
            ('product_id', 'in', product_ids),
            ('order_id.state', 'in', ['sale', 'done']),
            ('qty_delivered', '>', 0),
            ('create_date', '>=', fields.Datetime.to_string(date_from)),
        ]

        # Group by product_id and sum qty_delivered
        data = self.env['sale.order.line'].read_group(
            domain,
            ['product_id', 'qty_delivered:sum'],
            ['product_id']
        )

        sales_by_product = {
            group['product_id'][0]: group['qty_delivered'] for group in data if group['product_id']
        }

        for product in all_products:
            delivered_qty = sales_by_product.get(product.id, 0)
            _logger.info("🧮 Product %s: qty_delivered=%s", product.display_name, delivered_qty)
            product.sales_count_cache = float_round(
                delivered_qty,
                precision_rounding=product.uom_id.rounding
            )

        _logger.info("✅ Completed updating sales_count_cache for all products")
        return True
