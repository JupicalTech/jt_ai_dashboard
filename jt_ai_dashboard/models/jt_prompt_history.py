from odoo import models, fields

class JTPromptHistory(models.Model):
    _name = 'jt.prompt.history'
    _description = 'JT AI Prompt History'
    _order = 'create_date desc'

    prompt = fields.Char("Prompt", required=True)
    response = fields.Text("Response", required=True)
    user_id = fields.Many2one('res.users', string="User", default=lambda self: self.env.user, readonly=True)
    create_date = fields.Datetime("Created On", readonly=True)
