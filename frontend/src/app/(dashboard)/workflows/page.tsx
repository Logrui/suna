import { type Metadata } from "next";
import { WorkflowsPage } from "@/components/workflows/workflows-page";

export const metadata: Metadata = {
    title: "Workflows | Suna Kortix",
    description: "Manage your AI agent workflows and automation pipelines.",
};

export default function WorkflowsRoute() {
    return <WorkflowsPage />;
}
