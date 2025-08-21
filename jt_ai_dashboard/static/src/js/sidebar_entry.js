/** @odoo-module **/

import { registry } from "@web/core/registry";
import { PromptHistorySidebar } from "../components/PromptHistorySidebar";

// You can replace this with your dashboard or systray hook if needed
registry.category("action_widgets").add("jt_ai_dashboard.prompt_sidebar", {
    Component: PromptHistorySidebar,
});
