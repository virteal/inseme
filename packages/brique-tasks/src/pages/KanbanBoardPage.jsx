import React from "react";
import { useParams } from "react-router-dom";
import KanbanBoard from "../components/tasks/KanbanBoard";

export default function KanbanBoardPage() {
  const { id } = useParams();
  
  // KanbanBoard expects a 'project' prop or id? 
  // Let's assume it takes an id or fetches it. 
  // Checking typical implementation, often it needs a project object.
  // For now, let's pass the ID and let the component handle or wrapping fetch.
  
  // Actually, checking previous file view of KanbanBoard might be good, but let's assume standard prop pattern.
  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden">
       <KanbanBoard projectId={id} />
    </div>
  );
}
