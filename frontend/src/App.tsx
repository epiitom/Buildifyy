import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuroraBackground } from '@/components/ui/aurora-background';
import Home from './pages/Home.tsx';
import  {Builder} from './pages/Builder.tsx'
import './App.css';

function App() {
  return (
    <Router>
      <AuroraBackground>
        <Routes>
      <Route path="/" element={<Home />} />
        <Route path="/builder" element={<Builder />} />
         
        </Routes>
      </AuroraBackground>
    </Router>
  );
}

export default App;