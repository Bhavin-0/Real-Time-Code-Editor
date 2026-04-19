import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import CollaborativeEditor from './components/CollaborativeEditor.tsx';
import EntryPage from './components/EntryPage.tsx';

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<EntryPage />} />
        <Route path="/room/:roomId" element={<CollaborativeEditor />} />
      </Routes>
    </ThemeProvider>
  );
}
