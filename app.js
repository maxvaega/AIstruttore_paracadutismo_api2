// app.js
require("dotenv").config(); 

const express = require("express");
const { urlencoded, json } = require("body-parser");
const path = require("path");
const { checkEnvVars, verifySignature } = require("./actions");
const axios = require("axios");
const fetch = require("node-fetch-commonjs");
const fs = require("node:fs/promises");
const crypto = require("crypto");
const app = express();


// Parse application/x-www-form-urlencoded
app.use(
  urlencoded({
    extended: true,
  })
);

// Parse application/json. Verify that callback came from Facebook
app.use(json({ verify: verifySignature }));

checkEnvVars();

// simple test endpoint
app.get("/test", async function (req, res) {
  res.status(200).send({ msg: "Hi :)" });
});

// Add support for GET requests to our webhook
// test with curl -X GET "localhost:3000/messaging-webhook?hub.verify_token=FreeflyYourMind&hub.challenge=CHALLENGE_ACCEPTED&hub.mode=subscribe"
app.get("/messaging-webhook", (req, res) => {
  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    console.log("missing 'mode' and 'token'");
    res.sendStatus(403);
  }
});

// app.post("/_messaging-webhook", (req, res) => {
//   console.log("received webook");

//   axios
//     .get("https://jsonplaceholder.typicode.com/todos/1")
//     .then(() => {
//       console.log("resposnse finalmente");
//       res.status(200).send("EVENT_RECEIVED");
//     })
//     .catch((err) => {
//       console.log("error");
//       res.status(200).send("EVENT_RECEIVED");
//     });
// });

app.post("/messaging-webhook", async (req, res) => {
    const body = req.body;
    console.log(`## Received webhook:`);
  
    if (body.object === "instagram") {
      // Send the response immediately to the webhook
      res.status(200).send("EVENT_RECEIVED");
  
      try {
        // Process the entries asynchronously after sending the response
        const processMessages = body.entry.map(async (entry) => {
          // Loop through each message in the entry
          for (const webhookEvent of entry.messaging) {
            // Discard uninteresting events
            if (webhookEvent.read) {
              console.log("Got a read event");
              continue;
            } else if (webhookEvent.delivery) {
              console.log("Got a delivery event");
              continue;
            } else if (webhookEvent.message && webhookEvent.message.is_echo) {
              console.log(`Got an echo of our send, mid = ${webhookEvent.message.mid}`);
              continue;
            } else if (webhookEvent.message && webhookEvent.message.is_deleted) {
              console.log("Got a deleted message");
              continue;
            }
  
            if (!webhookEvent.message) {
              console.log("Cannot find message");
              continue;
            }
  
            if (!webhookEvent.message.text) {
              console.log("Cannot process non-textual message");
              continue;
            }
  
            console.dir(entry, { depth: null });
  
            // Get the sender PSID
            const senderPsid = webhookEvent.sender.id;
            if (senderPsid) {
              console.log("Now I can analyze event for PSID", senderPsid);
              const msg = webhookEvent.message.text;
  
              // Handle axios call asynchronously without blocking the response
              try {
                console.log("Trying axios POST");
                await axios.post(
                  `https://graph.facebook.com/v20.0/${process.env.PAGE_ID}/messages`,
                  {
                    recipient: { id: senderPsid },
                    messaging_type: "RESPONSE",
                    message: { text: msg },
                    access_token: process.env.ACCESS_TOKEN,
                  }
                );
                console.log("SENDED PONG => OK :)");
              } catch (error) {
                console.error("SENDED PONG => KO ;(");
                if (error.code === 'ECONNABORTED') {
                  console.error("Request timed out");
                } else if (error.response) {
                  console.error("Error response data:", error.response.data);
                  console.error("Error status:", error.response.status);
                  console.error("Error headers:", error.response.headers);
                } else if (error.request) {
                  console.error("No response received:", error.request);
                } else {
                  console.error("Error in setup:", error.message);
                }
              }
            } else {
              console.log("### NOT FOUND PSID");
            }
          }
        });
  
        // Execute all promises in parallel
        await Promise.all(processMessages);
  
      } catch (error) {
        console.error("Error processing webhook:", error);
      }
    } else {
      res.sendStatus(404);
    }
  });
  
  

// start the server.
const listener = app.listen(3000, () => {
  console.log(`The app is listening on port ${listener.address().port}`);

  if (process.env.PAGE_ID) {
    console.log("Test your app by messaging:");
    console.log(`https://m.me/${process.env.PAGE_ID}`);
  }
});


// Esporta l'app Express
module.exports = app;
