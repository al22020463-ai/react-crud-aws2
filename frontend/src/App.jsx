import { useState, useEffect } from 'react'
import './App.css'

import { Authenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
import '@aws-amplify/ui-react/styles.css';

function App() {
  const [tareas, setTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const API_URL = "https://kbi81twqv0.execute-api.us-east-1.amazonaws.com/tareas";

  const getHeaders = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      };
    } catch (error) {
      return { "Content-Type": "application/json" };
    }
  };

  const obtenerTareas = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      // Mapeamos para asegurar que 'completada' exista aunque el backend no la envíe inicialmente
      const listaProcesada = (Array.isArray(data) ? data : []).map(t => ({
        ...t,
        completada: !!t.completada 
      }));
      setTareas(listaProcesada);
    } catch (error) {
      console.error("Error obteniendo tareas:", error);
    }
  };

  const manejarAccion = async () => {
  if (!nuevaTarea.trim()) return;
  
  const metodo = editandoId ? "PUT" : "POST";
  
  // BUSCAMOS LA TAREA PARA NO PERDER SU ESTADO DE COMPLETADA
  const tareaExistente = tareas.find(t => t.id === editandoId);
  const estadoCompletado = tareaExistente ? tareaExistente.completada : false;

  const body = editandoId 
    ? { id: editandoId, info: nuevaTarea, completada: estadoCompletado } 
    : { info: nuevaTarea, completada: false };

  await fetch(API_URL, {
    method: metodo,
    headers: await getHeaders(), 
    body: JSON.stringify(body),
  });

  setNuevaTarea("");
  setEditandoId(null);
  obtenerTareas();
};

  const toggleCompletada = async (tarea) => {
    const nuevoEstado = !tarea.completada;

    // Optimistic UI: Actualizamos localmente primero para que se sienta instantáneo
    setTareas(tareas.map(t => t.id === tarea.id ? { ...t, completada: nuevoEstado } : t));

    try {
      await fetch(API_URL, {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify({ 
          id: tarea.id, 
          info: tarea.info, 
          completada: nuevoEstado 
        }),
      });
      obtenerTareas(); 
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      obtenerTareas(); // Revertir si falla
    }
  };

  const eliminarTarea = async (id) => {
    await fetch(API_URL, {
      method: "DELETE",
      headers: await getHeaders(),
      body: JSON.stringify({ id }),
    });
    obtenerTareas();
  };

  useEffect(() => { 
    obtenerTareas(); 
  }, []);

  return (
    <Authenticator.Provider>
      <div className="kanban-app">
        <header className="main-header">
          <div className="header-content">
            <h1>Mis Tareas en AWS</h1>
          </div>
        </header>

        <Authenticator loginMechanisms={['email']}>
          {({ signOut, user }) => (
            <main className="board-container">
              
              <div className="toolbar">
                <div className="user-pill">
                  <div className="avatar">{user.signInDetails?.loginId?.charAt(0).toUpperCase()}</div>
                  <span className="user-email">{user.signInDetails?.loginId}</span>
                  <button onClick={signOut} className="btn-logout-icon" title="Cerrar Sesión">✕</button>
                </div>

                <div className="input-group-modern">
                  <input 
                    className="task-input-modern"
                    value={nuevaTarea} 
                    onChange={(e) => setNuevaTarea(e.target.value)} 
                    placeholder="¿Qué tarea tienes pendiente?" 
                  />
                  <button onClick={manejarAccion} className="btn-add-modern">
                    {editandoId ? "✓" : "+"}
                  </button>
                  {editandoId && (
                    <button onClick={() => {setEditandoId(null); setNuevaTarea("");}} className="btn-cancel-modern">✕</button>
                  )}
                </div>
              </div>
              
              <div className="kanban-board">
                {/* COLUMNA PENDIENTES */}
                <div className="kanban-column pending">
                  <div className="column-header">
                    <h2>Pendientes</h2>
                    <span className="count-pill">{tareas.filter(t => !t.completada).length}</span>
                  </div>
                  <div className="column-body">
                    {tareas.filter(t => !t.completada).map(t => (
                      <div key={t.id} className="task-card">
                        <span className="task-text">{t.info}</span>
                        <div className="task-actions">
                          <button onClick={() => toggleCompletada(t)} className="action-icon check" title="Completar">✅</button>
                          <button onClick={() => {setNuevaTarea(t.info); setEditandoId(t.id);}} className="action-icon edit">✏️</button>
                          <button onClick={() => eliminarTarea(t.id)} className="action-icon delete">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUMNA HECHAS */}
                <div className="kanban-column completed">
                  <div className="column-header">
                    <h2>Hechas</h2>
                    <span className="count-pill">{tareas.filter(t => t.completada).length}</span>
                  </div>
                  <div className="column-body">
                    {tareas.filter(t => t.completada).map(t => (
                      <div key={t.id} className="task-card done">
                        <span className="task-text strikethrough">{t.info}</span>
                        <div className="task-actions">
                          <button onClick={() => toggleCompletada(t)} className="action-icon undo" title="Deshacer">↩️</button>
                          <button onClick={() => eliminarTarea(t.id)} className="action-icon delete">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          )}
        </Authenticator>
      </div>
    </Authenticator.Provider>
  );
}

export default App;