/** @odoo-module **/

import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry"; 
import { useService } from "@web/core/utils/hooks";
import { session } from "@web/session";
import { user } from "@web/core/user";

export class PromptHistorySidebar extends Component {
    static template = "jt_ai_dashboard.PromptHistorySidebar";
    static props = ["showSidebar", "onToggleSidebar"];

    setup() {
        this.orm = useService("orm");
        //this.session = useService("session");  // ✅ correctly access session service
        console.log("user======",this)
        console.log("session======",user.userId)
        this.state = useState({
            history: [],
            loading: true,
        });

        // ✅ Load data before rendering
        onWillStart(async () => {
            
            //const userId = this.session.userId;  // ✅ corrected line

            const records = await this.orm.searchRead(
                "jt.prompt.history",
                [["user_id", "=", user.userId]],
                ["create_date", "prompt", "response", "user_id"]
            );

            this.state.history = records;
            this.state.loading = false;
        });
    }
}
