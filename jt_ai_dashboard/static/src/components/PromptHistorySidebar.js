/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry"; 
import { useService } from "@web/core/utils/hooks";
import { session } from "@web/session";


export class PromptHistorySidebar extends Component {
    static template = "jt_ai_dashboard.PromptHistorySidebar";
    static props = ["showSidebar", "onToggleSidebar"];

    setup() {
        this.orm = useService("orm");
        console.log("user======",this)
        this.state = useState({
            history: [],
            loading: true,
        });
        
        onWillStart(async () => {

            const records = await this.orm.searchRead(
                "jt.prompt.history",
                [["user_id", "=", session.user_id]],
                ["create_date", "prompt", "response", "user_id"]
            );

            this.state.history = records;
            this.state.loading = false;
        });
    }
}
