import React, { useEffect, useState } from 'react';
import firebase from 'firebase/app'
import { EmailAuthCredential, getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, set, get, onValue } from "firebase/database";
import { app } from './Firebase/config';

const clientID = "4db376ff1b0941de8908d1748f1eb266";
const redirectURL = "http://localhost:3000/main";


const MainComponent = () => {
  const [name, setName] = useState("Nothing Currently Playing.");
  const [currentAccessToken, setToken] = useState("");
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [latitude, setLatitude] = useState(0.0);
  const [longitude, setLongitude] = useState(0.0);
  

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/auth.user
        const uid = user.uid;
        const currentEmail = user.email;
        console.log("userEmail " + currentEmail);
        setEmail(currentEmail);
        setUid(uid);
        // ...
      } else {
        console.log("signed out");
        // User is signed out
        // ...
      }
    });

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    const handleAuthentication = async () => {
      if (!code) {
        redirectToAuthCodeFlow(clientID);
      } else {
        console.log("got here!");
        if(currentAccessToken === "") {
          await getAccessToken(clientID, code);
        }


        const profile = await fetchProfile();
        //setToken(current);
        if(profile !== null) {
          if (profile.is_playing === true) {
            setName(profile.item.name);
            writeData(profile.item.name);
            getUsers();
          }
          else {
            setName("Nothing is currently playing.")
          }
        }
        
        
        else {
          setName("Nothing is currently playing.")
        }
      }
    };

    handleAuthentication();

    
    
    

  }, []);

  function writeData(currentPlayingSong) {
    const position = navigator.geolocation.getCurrentPosition((position) => {
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);

    });
    
    console.log(email);
    const db = getDatabase();
    set(ref(db, "users/" + uid), {
        userName:email,
        currentSong:currentPlayingSong,
        latitude: latitude,
        longitude: longitude
    });
  }

  const getUsers = async () => {
    const db = getDatabase();
    try {
      const usersRef = ref(db, 'users');
      const dataSnapshot = await get(usersRef);
  
      if (dataSnapshot.exists()) {
        const users = dataSnapshot.val();
        console.log(users);

        console.log("closest users: " + findClosestUsers(latitude, longitude, users, 500));
        
      } else {
        console.log('No users found');
      }
    } catch (error) {
      console.log('Error getting users:', error);
    }
  };


  const params = new URLSearchParams(window.location.search);
  const code = params.get('code')


  const refresh = async () => {
    if(currentAccessToken === "") {
      await getAccessToken(clientID, code);
    }
    const profile = await fetchProfile();

    if(profile !== null) {
      if (profile.is_playing === true) {
        setName(profile.item.name);
        writeData(profile.item.name);
        getUsers();
      }
      else {
        setName("Nothing is currently playing.")
      }
    }
    
    
    else {
      setName("Nothing is currently playing.")
    }
    

  }

  async function redirectToAuthCodeFlow(clientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectURL);
    params.append("scope", "user-read-private user-read-email user-read-currently-playing user-read-recently-played");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async function getAccessToken(clientId, code) {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://localhost:3000/main");
    params.append("code_verifier", verifier);

    const result = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    console.log(result.json);
    const { access_token } = await result.json();

    console.log("access token" + access_token);
    if (access_token !== undefined) {
      console.log("acess_token" + access_token);
      setToken(access_token);
      localStorage.setItem("accessToken", access_token);
    }
    return access_token;
  }

  async function fetchProfile() {
    const token = localStorage.getItem("accessToken");
    const result = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(result);
    if(result.status === 204) {
      return null;
    }
    return await result.json();
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const earthRadiusInFeet = 20903520; // Approximate Earth radius in feet
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceInFeet = earthRadiusInFeet * c;
    const roundedDistance = distanceInFeet.toFixed(2); // Round to two decimal places
    return roundedDistance;
  }

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function findClosestUsers(userLat, userLon, database, radius) {
    const distances = [];
    console.log("Database: " + database[0].longitude);
    for (const person in database) {
      console.log(database[person]);
      const distance = calculateDistance(userLat, userLon, database[person].latitude, database[person].longitude);
      console.log("distance: " + distance);
      if (distance <= radius) {
        distances.push({ user: database[person].userId, distance: distance});
      }
    }

    distances.sort((a, b) => a.distance - b.distance);
    console.log("this.state.distances:", distances);
    return distances;
  }






  refresh();

  return (
    <div>
      <h1>{name}</h1>
      <button onClick={() => refresh()}>Refresh</button>
    </div>
  );
};

export default MainComponent;