const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const supabaseUrl = "https://gpbvhgglhpdjhijyoekc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYnZoZ2dsaHBkamhpanlvZWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3ODAxNTQsImV4cCI6MjA3MzM1NjE1NH0.yUDGxkm9ikcRMcL5J995mYFtr6kUNvv7Yc8GUGiYNHU"; 
const supabase = createClient(supabaseUrl, supabaseKey);


const app = express();
const PORT = process.env.PORT || 3000; // correction pour Render

// === SERVEUR HTTP POUR LE FRONTEND ===
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Serveur web  VICTOR en ligne sur http://localhost:${PORT}`);
});

// === SERVEUR WEBSOCKET ===
const wss = new WebSocket.Server({ server });

// Gestion des connexions
let arduinoSocket = null; // stocke la connexion Arduino
let clients = []; // liste des navigateurs connectés

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`Nouvelle connexion depuis ${ip}`);
  

  // Identification du type de client (Arduino ou Frontend)
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
	  console.log(data.type);		

      // Identification Arduino
      if (data.type === 'arduino') {
        arduinoSocket = ws;
        console.log("Arduino connecté !");
		console.log(data.mac);
		console.log(data.temp);
		console.log(data.hum);
        ws.send(JSON.stringify({ type: 'server', msg: 'Arduino connecté au serveur' }));
		
		
		  const { error } = await supabase
		.from('RT_LOGGER')
		.insert([
		{ device: data.mac,  temp: data.temp, hum: data.hum  }  // champs adaptés à ta table
		]);
	
      }

      // Identification Frontend
      else if (data.type === 'browser') {
        clients.push(ws);
        console.log("Navigateur connecté !");
        ws.send(JSON.stringify({ type: 'server', msg: 'Navigateur connecté au serveur' }));
      }

      // Message de l'Arduino → envoyer à tous les navigateurs
      else if (data.type === 'sensor_update') {
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'arduino_data', payload: data.payload }));
          }
        });
      }

      // Message du navigateur → envoyer à l'Arduino
      else if (data.type === 'command') {
        if (arduinoSocket && arduinoSocket.readyState === WebSocket.OPEN) {
          arduinoSocket.send(JSON.stringify({ type: 'command', payload: data.payload }));
        }
      }

    } catch (e) {
      console.error("Erreur de parsing message :", e);
    }
  });

  // Gestion des déconnexions
  ws.on('close', () => {
    console.log("Client déconnecté");
    clients = clients.filter(client => client !== ws);
    if (ws === arduinoSocket) {
      arduinoSocket = null;
      console.log("Arduino déconnecté !");
    }
  });
});
