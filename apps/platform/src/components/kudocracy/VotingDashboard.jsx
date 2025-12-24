import React, { useState, useEffect } from "react";
import { getSupabase } from "../../lib/supabase";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#0A3F73", "#F54928", "#66BB6A", "#FFA726", "#42A5F5", "#FF5722"];

export default function VotingDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    const subscription = getSupabase()
      .channel("votes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => {
        loadStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadStats = async () => {
    setLoading(true);

    const [propositionsRes, votesRes, delegationsRes, usersRes, tagsRes] = await Promise.all([
      getSupabase()
        .from("propositions")
        .select("*, proposition_tags(tag:tags(*))")
        .eq("status", "active"),
      getSupabase().from("votes").select("*"),
      getSupabase().from("delegations").select("*"),
      getSupabase().from("users").select("id"),
      getSupabase().from("tags").select("*"),
    ]);

    if (
      propositionsRes.data &&
      votesRes.data &&
      delegationsRes.data &&
      usersRes.data &&
      tagsRes.data
    ) {
      const propositions = propositionsRes.data;
      const votes = votesRes.data;
      const delegations = delegationsRes.data;

      const propositionStats = propositions
        .map((prop) => {
          const propVotes = votes.filter((v) => v.proposition_id === prop.id);
          const approve = propVotes.filter((v) => v.vote_value === true).length;
          const disapprove = propVotes.filter((v) => v.vote_value === false).length;

          return {
            title: prop.title.substring(0, 30) + (prop.title.length > 30 ? "..." : ""),
            approve,
            disapprove,
            total: approve + disapprove,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const tagVotes = {};
      propositions.forEach((prop) => {
        prop.proposition_tags.forEach((pt) => {
          const tagName = pt.tag.name;
          const propVotes = votes.filter((v) => v.proposition_id === prop.id);

          if (!tagVotes[tagName]) {
            tagVotes[tagName] = { approve: 0, disapprove: 0 };
          }

          tagVotes[tagName].approve += propVotes.filter((v) => v.vote_value === true).length;
          tagVotes[tagName].disapprove += propVotes.filter((v) => v.vote_value === false).length;
        });
      });

      const tagStats = Object.entries(tagVotes)
        .map(([name, data]) => ({
          name,
          total: data.approve + data.disapprove,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

      const delegationsByTag = {};
      delegations.forEach((d) => {
        const tag = tagsRes.data.find((t) => t.id === d.tag_id);
        if (tag) {
          delegationsByTag[tag.name] = (delegationsByTag[tag.name] || 0) + 1;
        }
      });

      const delegationStats = Object.entries(delegationsByTag)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort((a, b) => b.value - a.value);

      const totalVotes = votes.length;
      const approveVotes = votes.filter((v) => v.vote_value === true).length;
      const disapproveVotes = votes.filter((v) => v.vote_value === false).length;

      setStats({
        totalPropositions: propositions.length,
        totalVotes,
        totalDelegations: delegations.length,
        totalUsers: usersRes.data.length,
        propositionStats,
        tagStats,
        delegationStats,
        voteDistribution: [
          { name: "Pour", value: approveVotes },
          { name: "Contre", value: disapproveVotes },
        ],
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
        <p className="text-gray-300 mt-4">Chargement des statistiques...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="   shadow-md p-12 text-center">
        <p className="text-gray-300">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Propositions actives"
          value={stats.totalPropositions}
          color="bg-blue-900"
        />
        <StatCard title="Votes totaux" value={stats.totalVotes} color="bg-green-600" />
        <StatCard title="Délégations" value={stats.totalDelegations} color="bg-yellow-600" />
        <StatCard title="Utilisateurs" value={stats.totalUsers} color="bg-red-600" />
      </div>

      <div className="   shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-50 mb-4">
          Top 10 propositions par nombre de votes
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats.propositionStats} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="title" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="approve" name="Pour" fill="#4CAF50" />
            <Bar dataKey="disapprove" name="Contre" fill="#F44336" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="   shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-50 mb-4">Distribution globale des votes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.voteDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.voteDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? "#4CAF50" : "#F44336"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="   shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-50 mb-4">Tags les plus actifs</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.tagStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" name="Votes" fill="#0A3F73" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats.delegationStats.length > 0 && (
        <div className="   shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-50 mb-4">Délégations par tag</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.delegationStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" name="Délégations" fill="#F54928" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="   shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-50 mb-4">Engagement</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 ">
            <p className="text-sm text-gray-300">Moyenne de votes par proposition</p>
            <p className="text-3xl font-bold text-blue-900">
              {stats.totalPropositions > 0
                ? (stats.totalVotes / stats.totalPropositions).toFixed(1)
                : 0}
            </p>
          </div>
          <div className="bg-green-50 p-4 ">
            <p className="text-sm text-gray-300">Moyenne de votes par utilisateur</p>
            <p className="text-3xl font-bold text-green-700">
              {stats.totalUsers > 0 ? (stats.totalVotes / stats.totalUsers).toFixed(1) : 0}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 ">
            <p className="text-sm text-gray-300">Taux de délégation</p>
            <p className="text-3xl font-bold text-yellow-700">
              {stats.totalUsers > 0
                ? ((stats.totalDelegations / stats.totalUsers) * 100).toFixed(0)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className={`${color} text-bauhaus-white   shadow-md p-6`}>
      <p className="text-sm opacity-90">{title}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
    </div>
  );
}
