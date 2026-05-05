import { useState } from "react";
import api from "../api";

export default function Projects() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    await api.post("/projects", { name, description });
    alert("Project created!");
  };

  return (
    <div>
      <h2>Create Project (Admin only)</h2>
      <input placeholder="Name" onChange={(e) => setName(e.target.value)} />
      <input placeholder="Description" onChange={(e) => setDescription(e.target.value)} />
      <button onClick={handleCreate}>Create</button>
    </div>
  );
}
