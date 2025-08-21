from odoo import models, fields
from datetime import date

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    def get_total_experience_years(self):
        self.ensure_one()
        total_days = 0
        today = date.today()

        resume_lines = self.env['hr.resume.line'].search([('employee_id', '=', self.id)])
        for line in resume_lines:
            start = line.date_start
            end = line.date_end or today
            if start and end and end >= start:
                total_days += (end - start).days

        years = total_days // 365
        months = (total_days % 365) // 30
        return f"{years} year(s), {months} month(s)"
