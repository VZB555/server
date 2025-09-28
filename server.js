const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');



const supabaseUrl = "https://gpbvhgglhpdjhijyoekc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYnZoZ2dsaHBkamhpanlvZWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3ODAxNTQsImV4cCI6MjA3MzM1NjE1NH0.yUDGxkm9ikcRMcL5J995mYFtr6kUNvv7Yc8GUGiYNHU"; 
const supabase = createClient(supabaseUrl, supabaseKey);




const app = express();
const PORT = process.env.PORT || 3000;

// === SERVEUR HTTP POUR LE FRONTEND ===
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur web VICTOR en ligne sur http://localhost:${PORT}`);
});

// === SERVEUR WEBSOCKET ===
const wss = new WebSocket.Server({ server });

// Gestion des connexions
let arduinoSocket = null;
let clients = [];

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Nouvelle connexion depuis ${ip}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log("📩 Message reçu :", data.type);

      // === Arduino connecté ===
      if (data.type === 'arduino') {
        arduinoSocket = ws;
        console.log("✅ Arduino connecté !");
        console.log("MAC:", data.mac, "Temp:", data.temp, "Hum:", data.hum);

        ws.send(JSON.stringify({ type: 'server', msg: 'Arduino connecté au serveur' }));

        // Insertion dans Supabase
        const { error } = await supabase
          .from('RT_LOGGER')
          .insert([
            { device: data.mac, temp: data.temp, hum: data.hum }
          ]);

        if (error) {
          console.error("❌ Erreur insertion Supabase (arduino) :", error);
        } else {
          console.log("📥 Données initiales Arduino insérées !");
        }
      }

      // === Navigateur connecté ===
      else if (data.type === 'browser') {
        clients.push(ws);
        console.log("🌐 Navigateur connecté !");
        ws.send(JSON.stringify({ type: 'server', msg: 'Navigateur connecté au serveur' }));
      }

      // === Données capteur (update régulier) ===
      else if (data.type === 'sensor_update') {
        // Nettoyage des sockets fermées
        clients = clients.filter(client => client.readyState === WebSocket.OPEN);

        // Diffusion aux navigateurs
        clients.forEach(client => {
          client.send(JSON.stringify({ type: 'arduino_data', payload: data.payload }));
        });

        // Insertion dans Supabase
        if (data.payload && data.payload.mac && data.payload.temp !== undefined && data.payload.hum !== undefined) {
          const { error } = await supabase
            .from('RT_LOGGER')
            .insert([
              { device: data.payload.mac, temp: data.payload.temp, hum: data.payload.hum }
            ]);

          if (error) {
            console.error("❌ Erreur insertion Supabase (sensor_update) :", error);
          } else {
            console.log("📥 Nouvelle mesure insérée :", data.payload);
          }
        } else {
          console.warn("⚠️ Données incomplètes reçues :", data.payload);
        }
      }

      // === Commande navigateur → Arduino ===
      else if (data.type === 'command') {
        if (arduinoSocket && arduinoSocket.readyState === WebSocket.OPEN) {
          arduinoSocket.send(JSON.stringify({ type: 'command', payload: data.payload }));
        }
      }

    } catch (e) {
      console.error("⚠️ Erreur de parsing message :", e);
    }
  });

  ws.on('close', () => {
    console.log("🔌 Client déconnecté");
    clients = clients.filter(client => client !== ws);
    if (ws === arduinoSocket) {
      arduinoSocket = null;
      console.log("❌ Arduino déconnecté !");
    }
  });
});
