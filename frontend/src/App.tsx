import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuroraBackground } from '@/components/ui/aurora-background';
import Home from './pages/Home.tsx';
import { Builder } from './pages/Builder.tsx'
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={
            <AuroraBackground>
              <Home />
            </AuroraBackground>
          } 
        />
        <Route path="/builder" element={<Builder />} />
      </Routes>
    </Router>
  );
}

export default App;