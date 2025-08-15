import { BrowserRouter, Routes, Route } from "react-router-dom";

import { GameScreen, GameOverScreen, JoinRoomScreen, LoadingScreen, LobbyScreen, LoginScreen, ResultsScreen, WaitingScreen } from "../pages/index.jsx";

const Router = () => {
    return (
        <BrowserRouter>
        <Routes>
            <Route path="/" element={<LoadingScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/lobby" element={<LobbyScreen />} />
            <Route path="/game" element={<GameScreen />} />
            <Route path="/join-room/:roomId" element={<JoinRoomScreen />} />
            <Route path="/waiting/:roomId" element={<WaitingScreen />} />
            <Route path="/results" element={<ResultsScreen />} />
            <Route path="/game-over" element={<GameOverScreen />} />
        </Routes>
        </BrowserRouter>
    );
    };
export default Router;