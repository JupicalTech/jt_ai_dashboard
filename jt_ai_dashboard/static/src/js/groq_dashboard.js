// /** @odoo-module **/
// import { registry } from "@web/core/registry";
// import { Layout } from "@web/search/layout";
// import { getDefaultConfig } from "@web/views/view";
// import { useService } from "@web/core/utils/hooks";
// import { useDebounced } from "@web/core/utils/timing";
// import { session } from "@web/session";
// import { Domain } from "@web/core/domain";
// import { sprintf } from "@web/core/utils/strings";
// import { jsonrpc } from '@web/core/network/rpc_service';

// const { Component, useSubEnv, useState, onMounted, onWillStart, useRef } = owl;
// import { loadJS } from "@web/core/assets";


// class GroqDashboard extends Component {
//     setup() {
//         this.state = useState({
//             question: "",
//             response: [],
//             chartData: null,
//         });
//         this.canvasRef = useRef("chartCanvas");
//         this.canvasRef1 = useRef("linechartCanvas")
//     }

//     async askQuestion() {
//         if (!this.state.question.trim()) {
//             this.state.response = [];
//             this.state.chartData = null;
//             return;
//         }

//         try {
            
//             const result = await jsonrpc("/web/dataset/call_kw/groq.prompt/create", {
//                 model: "groq.prompt",
//                 method: "create",
//                 args: [{ name: this.state.question }],
//                 kwargs: {},
//             });

            
//             const responseData = await jsonrpc("/web/dataset/call_kw/groq.prompt/read", {
//                 model: "groq.prompt",
//                 method: "read",
//                 args: [result], 
//                 kwargs: { fields: ["response"] },
//             });

//             let rawResponse = responseData[0]?.response || "No response received.";
//             console.log("Raw AI Response:", rawResponse);

           
//             let parsedResponse = rawResponse
//                 .split("\n")
//                 .filter(row => row.trim())
//                 .map(row => row.split(",").map(cell => cell.trim()));

//             console.log("Parsed Response:", parsedResponse);

//             if (parsedResponse.length > 0) {
//                 this.state.response = parsedResponse;

//                 const labels = parsedResponse.slice(1).map(row => row[0]); // X-axis
//                 // const values = parsedResponse.slice(1).map(row => parseFloat(row[1]) || 0); // Y-axis
//                 const values = parsedResponse.map(row => {
//                 let num = row[1].replace(/\D/g, ""); // Remove non-numeric characters from '(11'
//                 return num ? parseFloat(num) : 0;
//             });

//                 console.log('----------------values----------------',values)
//                 console.log('----------------labels----------------',labels)


//                 this.state.chartData = { labels, values };

//                 await this.renderChart();
//                 await this.renderlineChart();
//             } else {
//                 this.state.response = [["No valid data available"]];
//                 this.state.chartData = null;
//             }
//         } catch (error) {
//             console.error("Error fetching AI response:", error);
//             this.state.response = [["Error: Unable to get a response"]];
//             this.state.chartData = null;
//         }
//     }

//     async renderChart() {
//         await loadJS("https://cdn.jsdelivr.net/npm/chart.js"); 

//         const canvas = this.canvasRef.el;
//         if (!canvas || !this.state.chartData) return;

//         const ctx = canvas.getContext("2d");

//         if (this.chartInstance) {
//             this.chartInstance.destroy();
//         }

//         this.chartInstance = new Chart(ctx, {
//             type: "bar",
//             data: {
//                 labels: this.state.chartData.labels,
//                 datasets: [{
//                     label: "AI Response Data",
//                     data: this.state.chartData.values,
//                     backgroundColor: "rgba(75, 192, 192, 0.6)",
//                     borderColor: "rgba(75, 192, 192, 1)",
//                     borderWidth: 1
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: { beginAtZero: true }
//                 }
//             }
//         });
//     }

//     async renderlineChart() {
//         await loadJS("https://cdn.jsdelivr.net/npm/chart.js"); 

//         const canvas = this.canvasRef1.el;
//         if (!canvas || !this.state.chartData) return;

//         const ctx = canvas.getContext("2d");

//         if (this.chartInstance1) {
//             this.chartInstance1.destroy();
//         }

//         this.chartInstance1 = new Chart(ctx, {
//             type: "line",
//             data: {
//                 labels: this.state.chartData.labels,
//                 datasets: [{
//                     label: "AI Response Data",
//                     data: this.state.chartData.values,
//                     backgroundColor: "rgba(75, 192, 192, 0.6)",
//                     borderColor: "rgba(75, 192, 192, 1)",
//                     borderWidth: 1
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: { beginAtZero: true }
//                 }
//             }
//         });
//     }
// }
// console.log("GroqDashboard JS Loaded");

// GroqDashboard.template = "groq_api_odoo.ai_dashboard";
// registry.category("actions").add("ai_dashboard", GroqDashboard);

// /** @odoo-module **/

// import { registry } from "@web/core/registry";
// import { useService } from "@web/core/utils/hooks";
// import { Component, useState, useRef, onWillStart } from "@odoo/owl";

// export class GroqDashboard extends Component {
//     static template = "groq_api_odoo.ai_dashboard"; // Reference to your QWeb template

//     setup() {
//         // ORM service to call Odoo models
//         this.orm = useService("orm");

//         // Reactive state
//         this.state = useState({
//             question: "",
//             response: [],
//             chartData: null,
//         });

//         // References for canvases
//         this.canvasRef = useRef("chartCanvas");
//         this.canvasRef1 = useRef("linechartCanvas");

//         // Chart.js instances
//         this.chartInstance = null;
//         this.chartInstance1 = null;

//         // Load Chart.js when the component is about to mount
//         onWillStart(() => this.loadChartJS());
//     }

//     /**
//      * Send the question to the AI (groq.prompt model) and process the response.
//      */

//     onKeyPress(event) {
//         if (event.key === "Enter") {
//             // Call the same method as the button click when Enter is pressed
//             this.askQuestion();
//         }
//     }

//     async askQuestion() {
//         const questionText = this.state.question.trim();
//         if (!questionText) {
//             this.state.response = [];
//             this.state.chartData = null;
//             return;
//         }

//         try {
//             // Create a prompt record
//             const [recordId] = await this.orm.create("groq.prompt", [{ name: questionText }]);

//             // Read the AI response
//             const [record] = await this.orm.read("groq.prompt", [recordId], ["response"]);
//             const rawResponse = record?.response || "No response received.";
//             console.log("Raw AI Response:", rawResponse);

//             // Parse CSV-style response
//             const parsedResponse = rawResponse
//                 .split("\n")
//                 .filter(row => row.trim())
//                 .map(row => row.split(",").map(cell => cell.trim()));

//             if (parsedResponse.length > 0) {
//                 this.state.response = parsedResponse;

//                 const labels = parsedResponse.slice(1).map(row => row[0]);
//                 const values = parsedResponse.slice(1).map(row => {
//                     const num = row[1]?.replace(/\D/g, "");
//                     return num ? parseFloat(num) : 0;
//                 });

//                 this.state.chartData = { labels, values };

//                 await this.renderChart();
//                 await this.renderLineChart();
//             } else {
//                 this.state.response = [["No valid data available"]];
//                 this.state.chartData = null;
//             }
//         } catch (error) {
//             console.error("Error fetching AI response:", error);
//             this.state.response = [["Error: Unable to get a response"]];
//             this.state.chartData = null;
//         }
//     }

//     /**
//      * Render a bar chart using Chart.js
//      */
//     async renderChart() {
//         const canvas = this.canvasRef.el;
//         if (!canvas || !this.state.chartData) return;

//         const ctx = canvas.getContext("2d");
//         if (this.chartInstance) {
//             this.chartInstance.destroy();
//         }

//         this.chartInstance = new window.Chart(ctx, {
//             type: "bar",
//             data: {
//                 labels: this.state.chartData.labels,
//                 datasets: [{
//                     label: "AI Response Data",
//                     data: this.state.chartData.values,
//                     backgroundColor: "rgba(75, 192, 192, 0.6)",
//                     borderColor: "rgba(75, 192, 192, 1)",
//                     borderWidth: 1,
//                 }],
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: { beginAtZero: true },
//                 },
//             },
//         });
//     }

//     /**
//      * Render a line chart using Chart.js
//      */
//     async renderLineChart() {
//         const canvas = this.canvasRef1.el;
//         if (!canvas || !this.state.chartData) return;

//         const ctx = canvas.getContext("2d");
//         if (this.chartInstance1) {
//             this.chartInstance1.destroy();
//         }

//         this.chartInstance1 = new window.Chart(ctx, {
//             type: "line",
//             data: {
//                 labels: this.state.chartData.labels,
//                 datasets: [{
//                     label: "AI Response Data",
//                     data: this.state.chartData.values,
//                     backgroundColor: "rgba(75, 192, 192, 0.6)",
//                     borderColor: "rgba(75, 192, 192, 1)",
//                     borderWidth: 1,
//                 }],
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: { beginAtZero: true },
//                 },
//             },
//         });
//     }

//     /**
//      * Dynamically load Chart.js from CDN if not already loaded.
//      */
//     async loadChartJS() {
//         if (!window.Chart) {
//             return new Promise((resolve) => {
//                 const script = document.createElement("script");
//                 script.src = "https://cdn.jsdelivr.net/npm/chart.js";
//                 script.onload = resolve;
//                 document.head.appendChild(script);
//             });
//         }
//         return Promise.resolve();
//     }

//     /**
//      * Cleanup charts when the component is destroyed.
//      */
//     willUnmount() {
//         if (this.chartInstance) {
//             this.chartInstance.destroy();
//         }
//         if (this.chartInstance1) {
//             this.chartInstance1.destroy();
//         }
//     }
// }

// // ✅ Correctly register the client action using the Component directly
// registry.category("actions").add("ai_dashboard", GroqDashboard);



// Version 3
// /** @odoo-module **/

// import { registry } from "@web/core/registry";
// import { useService } from "@web/core/utils/hooks";
// import { Component, useState, useRef } from "@odoo/owl";
// import { PromptHistorySidebar } from "../components/PromptHistorySidebar";

// export class GroqDashboard extends Component {
//     static template = "jt_ai_dashboard.ai_dashboard";
//     static components = { PromptHistorySidebar };

//     setup() {
//         this.orm = useService("orm");
//         this.notification = useService("notification");
        
//         this.state = useState({
//             question: "",
//             response: [],
//             chartData: null,
//             showSidebar: true,
//         });

//         this.canvasRef = useRef("chartCanvas");
//         this.canvasRef1 = useRef("linechartCanvas");

//         this.chartInstance = null;
//         this.chartInstance1 = null;

//         this.loadChartJS();
//     }

//     toggleSidebar() {
//         this.state.showSidebar = !this.state.showSidebar;
//     }

//     onKeyPress(event) {
//         if (event.key === "Enter") {
//             event.preventDefault();
//             this.askQuestion();
//         }
//     }

//     async askQuestion() {
//         const questionText = this.state.question.trim();
//         if (!questionText) {
//             this.notification.add("Please enter a question.", { type: "warning" });
//             this.state.response = [];
//             this.state.chartData = null;
//             return;
//         }

//         try {
//             const [recordId] = await this.orm.create("groq.prompt", [{ name: questionText }]);
//             const [record] = await this.orm.read("groq.prompt", [recordId], ["response"]);
//             const rawResponse = record?.response || "No response received.";

//             if (!rawResponse.includes(",")) {
//                 this.notification.add("Invalid response format from AI.", { type: "danger" });
//                 this.state.response = [["Invalid response format"]];
//                 this.state.chartData = null;
//                 return;
//             }

//             const parsedResponse = rawResponse
//                 .split("\n")
//                 .filter(row => row.trim())
//                 .map(row => {
//                     const cells = row.split(",").map(cell => cell.trim());
//                     return cells.length >= 2 ? cells : ["Invalid row", "0"];
//                 });

//             if (parsedResponse.length > 0) {
//                 const firstColumns = parsedResponse.map(row => row[0]);
//                 const uniqueFirstColumns = new Set(firstColumns);

//                 if (uniqueFirstColumns.size < firstColumns.length) {
//                     this.state.response = parsedResponse.filter(
//                         (row, index, self) => index === self.findIndex(r => r[0] === row[0])
//                     );
//                     this.notification.add("Duplicates removed from response.", { type: "info" });
//                 } else {
//                     this.state.response = parsedResponse;
//                 }

//                 const labels = parsedResponse.slice(1).map(row => row[0] || "Unknown");
//                 const values = parsedResponse.slice(1).map(row => {
//                     const num = row[1]?.replace(/\D/g, "");
//                     return num ? parseFloat(num) : 0;
//                 });

//                 if (labels.length > 0 && values.length > 0) {
//                     this.state.chartData = { labels, values };
//                     await this.renderChart();
//                     await this.renderLineChart();
//                 } else {
//                     this.state.chartData = null;
//                     this.notification.add("No valid chart data available.", { type: "warning" });
//                 }
//             } else {
//                 this.state.response = [["No valid data available"]];
//                 this.state.chartData = null;
//                 this.notification.add("No valid data received from AI.", { type: "warning" });
//             }
//         } catch (error) {
//             console.error("Error fetching AI response:", error);
//             this.state.response = [["Error: Unable to get a response"]];
//             this.state.chartData = null;
//             this.notification.add("Failed to fetch AI response.", { type: "danger" });
//         }

//         this.state.question = "";
//     }

//     async renderChart() {
//         const canvas = this.canvasRef.el;
//         if (!canvas || !this.state.chartData) return;

//         const ctx = canvas.getContext("2d");
//         if (this.chartInstance) {
//             this.chartInstance.destroy();
//         }

//         this.chartInstance = new window.Chart(ctx, {
//             type: "bar",
//             data: {
//                 labels: this.state.chartData.labels,
//                 datasets: [{
//                     label: "AI Response Data",
//                     data: this.state.chartData.values,
//                     backgroundColor: "rgba(75, 192, 192, 0.6)",
//                     borderColor: "rgba(75, 192, 192, 1)",
//                     borderWidth: 1,
//                 }],
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: { beginAtZero: true },
//                 },
//             },
//         });
//     }

//     async renderLineChart() {
//         const canvas = this.canvasRef1.el;
//         if (!canvas || !this.state.chartData) return;

//         const ctx = canvas.getContext("2d");
//         if (this.chartInstance1) {
//             this.chartInstance1.destroy();
//         }

//         this.chartInstance1 = new window.Chart(ctx, {
//             type: "line",
//             data: {
//                 labels: this.state.chartData.labels,
//                 datasets: [{
//                     label: "AI Response Data",
//                     data: this.state.chartData.values,
//                     backgroundColor: "rgba(75, 192, 192, 0.6)",
//                     borderColor: "rgba(75, 192, 192, 1)",
//                     borderWidth: 1,
//                 }],
//             },
//             options: {
//                 responsive: true,
//                 scales: {
//                     y: { beginAtZero: true },
//                 },
//             },
//         });
//     }

//     async loadChartJS() {
//         if (!window.Chart) {
//             console.error("Chart.js is not loaded. Ensure it is included in the module's assets.");
//             throw new Error("Chart.js not available");
//         }
//     }

//     willUnmount() {
//         if (this.chartInstance) this.chartInstance.destroy();
//         if (this.chartInstance1) this.chartInstance1.destroy();
//     }
// }

// registry.category("actions").add("ai_dashboard", GroqDashboard);


// version 4 and final
/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, useState, useRef } from "@odoo/owl";
import { PromptHistorySidebar } from "../components/PromptHistorySidebar";


export class GroqDashboard extends Component {
    static template = "jt_ai_dashboard.ai_dashboard";
    static components = { PromptHistorySidebar };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            question: "",
            response: [],
            chartData: null,
            showSidebar: true,
        });

        this.canvasRef = useRef("chartCanvas");
        this.canvasRef1 = useRef("linechartCanvas");

        this.chartInstance = null;
        this.chartInstance1 = null;

        this.loadChartJS();
    }

    toggleSidebar() {
        this.state.showSidebar = !this.state.showSidebar;
    }

    onKeyPress(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            this.askQuestion();
        }
    }

    async askQuestion() {
        const questionText = this.state.question.trim();
        if (!questionText) {
            this.notification.add("Please enter a question.", { type: "warning" });
            this.state.response = [];
            this.state.chartData = null;
            return;
        }

        try {
            // Create prompt record triggering AI backend processing
            const [recordId] = await this.orm.create("groq.prompt", [{ name: questionText }]);
            const [record] = await this.orm.read("groq.prompt", [recordId], ["response"]);
            const rawResponse = record?.response?.trim() || "No response received.";

            // Distinguish structured (CSV-like) vs plain text response based on presence of commas
            if (rawResponse.includes(",")) {
                // Parse CSV-style response into array of rows and columns
                const parsedResponse = rawResponse
                    .split("\n")
                    .filter(row => row.trim())
                    .map(row => {
                        const cells = row.split(",").map(cell => cell.trim());
                        return cells.length >= 2 ? cells : ["Invalid row", "0"];
                    });
                this.state.response = parsedResponse;
                // Remove duplicate rows based on first column (if any duplicates)
                // const firstColumns = parsedResponse.map(row => row[0]);
                // const uniqueFirstColumns = new Set(firstColumns);

                // if (uniqueFirstColumns.size < firstColumns.length) {
                //     this.state.response = parsedResponse.filter(
                //         (row, index, self) => index === self.findIndex(r => r[0] === row[0])
                //     );
                //     this.notification.add("Duplicates removed from response.", { type: "info" });
                // } else {
                //     this.state.response = parsedResponse;
                // }

                // Extract labels and numeric values for charts
                const labels = parsedResponse.slice(1).map(row => row[0] || "Unknown");
                const values = parsedResponse.slice(1).map(row => {
                    // Remove any non-digit characters to parse numbers robustly
                    const num = row[1]?.replace(/[^\d.-]/g, "");
                    return num ? parseFloat(num) : 0;
                });

                if (labels.length > 0 && values.length > 0) {
                    this.state.chartData = { labels, values };
                    await this.renderChart();
                    await this.renderLineChart();
                } else {
                    this.state.chartData = null;
                    this.notification.add("No valid chart data available.", { type: "warning" });
                }

            } else {
                // Plain text response: show it directly without error notification
                this.state.response = [[rawResponse]];
                this.state.chartData = null;
                // Optionally, you can add an info notification like:
                // this.notification.add(rawResponse, { type: "info" });
            }
        } catch (error) {
            console.error("Error fetching AI response:", error);
            this.state.response = [["Error: Unable to get a response"]];
            this.state.chartData = null;
            this.notification.add("Failed to fetch AI response.", { type: "danger" });
        }

        this.state.question = "";
    }

    async renderChart() {
        const canvas = this.canvasRef.el;
        if (!canvas || !this.state.chartData) return;

        const ctx = canvas.getContext("2d");
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new window.Chart(ctx, {
            type: "bar",
            data: {
                labels: this.state.chartData.labels,
                datasets: [{
                    label: "AI Response Data",
                    data: this.state.chartData.values,
                    backgroundColor: "rgba(75, 192, 192, 0.6)",
                    borderColor: "rgba(75, 192, 192, 1)",
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true },
                },
            },
        });
    }

    async renderLineChart() {
        const canvas = this.canvasRef1.el;
        if (!canvas || !this.state.chartData) return;

        const ctx = canvas.getContext("2d");
        if (this.chartInstance1) {
            this.chartInstance1.destroy();
        }

        this.chartInstance1 = new window.Chart(ctx, {
            type: "line",
            data: {
                labels: this.state.chartData.labels,
                datasets: [{
                    label: "AI Response Data",
                    data: this.state.chartData.values,
                    backgroundColor: "rgba(75, 192, 192, 0.6)",
                    borderColor: "rgba(75, 192, 192, 1)",
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true },
                },
            },
        });
    }

    async loadChartJS() {
        if (!window.Chart) {
            console.error("Chart.js is not loaded. Ensure it is included in the module's assets.");
            throw new Error("Chart.js not available");
        }
    }

    willUnmount() {
        if (this.chartInstance) this.chartInstance.destroy();
        if (this.chartInstance1) this.chartInstance1.destroy();
    }
}

registry.category("actions").add("ai_dashboard", GroqDashboard);
