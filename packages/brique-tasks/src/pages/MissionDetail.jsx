import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getSupabase } from "@inseme/cop-host";
import MissionCard from "../components/missions/MissionCard";

export default function MissionDetail() {
  const { id } = useParams();
  const [mission, setMission] = useState(null);

  useEffect(() => {
    getSupabase().from("missions").select("*").eq("id", id).single().then(({data}) => setMission(data));
  }, [id]);

  if (!mission) return <div>Chargement...</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
       <MissionCard mission={mission} detailed />
    </div>
  );
}
