import { useState, useEffect } from 'react'
import './App.css'

// 1. Importaciones de AWS Amplify
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
      setTareas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error obteniendo tareas:", error);
    }
  };

  const manejarAccion = async () => {
    if (!nuevaTarea.trim()) return;
    const metodo = editandoId ? "PUT" : "POST";
    const body = editandoId ? { id: editandoId, info: nuevaTarea } : { info: nuevaTarea };

    await fetch(API_URL, {
      method: metodo,
      headers: await getHeaders(), 
      body: JSON.stringify(body),
    });

    setNuevaTarea("");
    setEditandoId(null);
    obtenerTareas();
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
      <div className="App">
        {/* --- CABECERA PÚBLICA (SIEMPRE VISIBLE) --- */}
        <header>
          <h1>Mis Tareas en AWS</h1>
        </header>
        <div className="separator"></div>

        {/* --- EL GUARDIÁN: SOLO PROTEGE LO QUE ESTÁ ADENTRO --- */}
        <Authenticator>
          {({ signOut, user }) => (
            /* --- ESTA ES LA NUEVA TARJETA BLANCA --- */
            <main className="auth-card-container">
              
              {/* 1. Panel de Usuario (Email y Botón) */}
              <div className="user-info-panel">
                <span className="user-email">Bienvenido, <b>{user.signInDetails?.loginId}</b></span>
                <button onClick={signOut} className="btn-logout">Cerrar Sesión</button>
              </div>

              {/* 2. Formulario CRUD (Input y Botón) */}
              <div className="input-group">
                <input 
                  className="task-input"
                  value={nuevaTarea} 
                  onChange={(e) => setNuevaTarea(e.target.value)} 
                  placeholder="¿Qué tarea tienes pendiente?" 
                />
                <button onClick={manejarAccion} className="btn-primary-action">
                  {editandoId ? "Guardar" : "Agregar"}
                </button>
              </div>
              
              {/* 3. Lista de Tareas */}
              <ul className="task-list-display">
                {tareas.map(t => (
                  <li key={t.id} className="task-item-card">
                    <span className="task-content-text">{t.info}</span>
                    <div className="task-actions-group">
                      <button onClick={() => {setNuevaTarea(t.info); setEditandoId(t.id);}} className="btn-icon">✏️</button>
                      <button onClick={() => eliminarTarea(t.id)} className="btn-icon">🗑️</button>
                    </div>
                  </li>
                ))}
                {tareas.length === 0 && (
                  <p className="no-tasks-msg">No hay tareas pendientes.</p>
                )}
              </ul>
            </main>
          )}
        </Authenticator>
      </div>
    </Authenticator.Provider>
  );
}

export default App;