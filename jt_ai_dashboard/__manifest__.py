{
    'name': 'Jupical Technologies AI Dashboard',
    'version': '18.0.1.0.0',
    'summary': 'Use AI to answer Odoo module-related questions and Display Them Efficiently',
    'author': 'Jupical Technologies',
    'depends': ['base','web','hr', 'product','stock','sale_management'],
    'data': [
        'security/models.xml',   
        'security/ir.model.access.csv',
        'views/ai_prompt_view.xml',
        'views/jt_prompt_history_views.xml',
        'views/menu.xml',
    ],
    
    'assets': {
        'web.assets_backend': [
            'jt_ai_dashboard/static/src/xml/prompt_history_sidebar.xml',
            'jt_ai_dashboard/static/src/xml/dashboard.xml',
            'jt_ai_dashboard/static/src/components/PromptHistorySidebar.js',
            'jt_ai_dashboard/static/src/js/groq_dashboard.js',
            'jt_ai_dashboard/static/src/js/sidebar_entry.js',
            'jt_ai_dashboard/static/src/css/styles.css',
            'jt_ai_dashboard/static/src/scss/sidebar.scss',
            'https://cdn.jsdelivr.net/npm/chart.js',
        ],
    },

    'installable': True,
    'application': True,
}