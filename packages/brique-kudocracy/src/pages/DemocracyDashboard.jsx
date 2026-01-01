import VotingDashboard from "../components/kudocracy/VotingDashboard";

export default function DemocracyDashboard() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Gouvernance Citoyenne</h1>
      <VotingDashboard />
    </div>
  );
}
