from odoo import http
from odoo.http import request

class GroqAIController(http.Controller):
    @http.route('/groq/prompt/ask', type='json', auth='user', methods=['POST'])
    def ask_groq(self, **kwargs):
        prompt = kwargs.get("prompt")
        if not prompt:
            return {"response": "Error: No prompt received."}

        record = request.env['groq.prompt'].create({'name': prompt})
        return {"response": record.response}
