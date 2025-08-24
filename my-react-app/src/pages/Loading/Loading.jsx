import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LoadingScreen = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            navigate("/select");
        }, 2000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return <LoadingComponent />;
};

export default LoadingScreen;