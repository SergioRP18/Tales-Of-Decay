import { BrowserRouter, Routes, Route } from "react-router-dom";

import { GameScreen, GameOverScreen, JoinRoomScreen, LoadingScreen, LobbyScreen, LoginScreen, ResultsScreen, WaitingScreen, Home, FeedbackScreen, PreChapter } from "../pages/index.jsx";

const Router = () => {
    return (
        <BrowserRouter>
        <Routes>
            <Route path="/" element={<LoadingScreen />} />
            <Route path="/select" element={<Home />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/lobby" element={<LobbyScreen />} />
            <Route path="/precapitulo/:roomId" element={<PreChapter />} />
            <Route path="/game/:roomId" element={<GameScreen />} />
            <Route path="/feedback/:roomId" element={<FeedbackScreen />} />
            <Route path="/join-room" element={<JoinRoomScreen />} />
            <Route path="/join-room/:roomId" element={<JoinRoomScreen />} />
            <Route path="/waiting/:roomId" element={<WaitingScreen />} />
            <Route path="/results" element={<ResultsScreen />} />
            <Route path="/game-over" element={<GameOverScreen />} />
        </Routes>
        </BrowserRouter>
    );
    };
export default Router;