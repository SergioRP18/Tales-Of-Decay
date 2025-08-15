import { configureStore, createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signInAnon } from "../firebase";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { auth } from "../firebase";

// Async thunk para iniciar sesión anónima
export const signInAnonymous = createAsyncThunk(
  "user/signInAnonymous",
  async () => {
    const userCredential = await signInAnon();
    return userCredential.user;
  }
);

// Async thunk para guardar el username
export const saveUsername = createAsyncThunk(
  "user/saveUsername",
  async (username, { getState }) => {
    const db = getFirestore();
    const uid = auth.currentUser.uid;
    await setDoc(doc(db, "users", uid), { username });
    return username;
  }
);

// Async thunk para cargar el username (opcional)
export const fetchUsername = createAsyncThunk(
  "user/fetchUsername",
  async (_, { getState }) => {
    const db = getFirestore();
    const uid = auth.currentUser.uid;
    const docSnap = await getDoc(doc(db, "users", uid));
    return docSnap.exists() ? docSnap.data().username : null;
  }
);

const userSlice = createSlice({
  name: "user",
  initialState: {
    uid: null,
    username: null,
    status: "idle",
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(signInAnonymous.fulfilled, (state, action) => {
        state.uid = action.payload.uid;
      })
      .addCase(saveUsername.fulfilled, (state, action) => {
        state.username = action.payload;
      })
      .addCase(fetchUsername.fulfilled, (state, action) => {
        state.username = action.payload;
      });
  },
});

const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
});

export default store;