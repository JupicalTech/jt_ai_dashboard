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
            // const [recordId] = await this.orm.create("groq.prompt", [{ name: questionText }]);
            // const [record] = await this.orm.read("groq.prompt", [recordId], ["response"]);
            // const rawResponse = record?.response?.trim() || "No response received.";

            // Create prompt record triggering AI backend processing
            const recordId = await this.orm.create("groq.prompt", [{ name: questionText }]);

            // Read the response
            const records = await this.orm.read("groq.prompt", [recordId], ["response"]);
            const record = records.length ? records[0] : null;

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
