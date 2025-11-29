import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { GameState, GamePhase, CardSource, CardData, RoundRecord } from './types';
import { generateTrendCards, generateThemeImage, generateSingleCardInput } from './services/gemini';
import { CardDeck } from './components/CardDeck';
import { ParticleText } from './components/ParticleText';

// Using a high-quality Unsplash image that resembles a wooden object/nature scene as a proxy for the Totem
const DEFAULT_BG = "https://images.unsplash.com/photo-1764431483776-b56c73fa92a1?q=80&w=1932&auto=format&fit=crop";

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    currentRound: 1,
    totalRounds: 3,
    phase: GamePhase.SETUP,
    roundTitles: {},
    allOrganizerCards: {},
    participantCards: [],
    deck: [],
    selectedCard: null,
    previousTheme: "Start"
  });

  // Setup State
  const [setupRounds, setSetupRounds] = useState(3);
  const [setupTitles, setSetupTitles] = useState<Record<number, string>>({
    1: "角色", 2: "地點", 3: "事件", 4: "氣氛"
  });
  const [setupOrganizerInputs, setSetupOrganizerInputs] = useState<Record<number, string[]>>({
    1: ["", ""],
    2: ["", ""],
    3: ["", ""]
  });

  const [participantInput, setParticipantInput] = useState(['', '', '', '']);
  const [loadingAI, setLoadingAI] = useState(false);
  // Track individual loading states for the 4 participant inputs
  const [loadingSingleAI, setLoadingSingleAI] = useState<boolean[]>([false, false, false, false]);
  
  // New States for Visuals & History
  const [roundHistory, setRoundHistory] = useState<RoundRecord[]>([]);
  const [generatedBgImage, setGeneratedBgImage] = useState<string | null>(null);

  // --- Handlers ---

  const handleRoundsChange = (num: number) => {
    const newCount = Math.max(1, Math.min(10, num));
    setSetupRounds(newCount);
    
    // Adjust organizer inputs state
    const newInputs = { ...setupOrganizerInputs };
    const newTitles = { ...setupTitles };

    for (let i = 1; i <= newCount; i++) {
        if (!newInputs[i]) newInputs[i] = ["", ""];
        if (!newTitles[i]) newTitles[i] = `Round ${i}`;
    }
    setSetupOrganizerInputs(newInputs);
    setSetupTitles(newTitles);
  };

  const handleOrganizerInputChange = (round: number, index: number, value: string) => {
    const newInputs = { ...setupOrganizerInputs };
    newInputs[round] = [...newInputs[round]];
    newInputs[round][index] = value;
    setSetupOrganizerInputs(newInputs);
  };

  const handleSetupTitleChange = (round: number, value: string) => {
    setSetupTitles(prev => ({ ...prev, [round]: value }));
  };

  const handleSetupSubmit = () => {
    const finalOrganizerCards: Record<number, string[]> = {};
    const finalTitles: Record<number, string> = {};

    for (let i = 1; i <= setupRounds; i++) {
        const cards = setupOrganizerInputs[i] || ["", ""];
        finalOrganizerCards[i] = [
            cards[0] || "Default A",
            cards[1] || "Default B"
        ];
        finalTitles[i] = setupTitles[i] || `Round ${i}`;
    }

    setGameState(prev => ({
      ...prev,
      totalRounds: setupRounds,
      roundTitles: finalTitles,
      allOrganizerCards: finalOrganizerCards,
      phase: GamePhase.ROUND_INPUT
    }));
  };

  const handleSingleAIGenerate = async (index: number) => {
    const currentTitle = gameState.roundTitles[gameState.currentRound] || "Game Concept";
    
    setLoadingSingleAI(prev => {
        const next = [...prev];
        next[index] = true;
        return next;
    });

    try {
        const result = await generateSingleCardInput(currentTitle);
        setParticipantInput(prev => {
            const next = [...prev];
            next[index] = result;
            return next;
        });
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingSingleAI(prev => {
            const next = [...prev];
            next[index] = false;
            return next;
        });
    }
  };

  const handleParticipantSubmit = async () => {
    const currentTitle = gameState.roundTitles[gameState.currentRound] || "Game Concept";
    
    setGameState(prev => ({
      ...prev,
      participantCards: participantInput,
      phase: GamePhase.GENERATING
    }));
    setLoadingAI(true);

    const aiThemes = await generateTrendCards(currentTitle);
    setLoadingAI(false);

    const roundOrgCards = gameState.allOrganizerCards[gameState.currentRound] || ["Error", "Error"];

    const newDeck: CardData[] = [
      ...participantInput.map(t => ({ id: uuidv4(), text: t, source: CardSource.PARTICIPANT })),
      ...roundOrgCards.map(t => ({ id: uuidv4(), text: t, source: CardSource.ORGANIZER })),
      ...aiThemes.map(t => ({ id: uuidv4(), text: t, source: CardSource.AI }))
    ];

    setGameState(prev => ({
      ...prev,
      deck: newDeck,
      phase: GamePhase.PREVIEW
    }));

    setTimeout(() => {
        setGameState(prev => ({ ...prev, phase: GamePhase.SHUFFLING }));
        setTimeout(() => {
             setGameState(prev => ({ ...prev, phase: GamePhase.SELECTION }));
        }, 3000);
    }, 6000); 
  };

  const handleCardSelect = async (card: CardData) => {
    setGameState(prev => ({
      ...prev,
      selectedCard: card,
      phase: GamePhase.REVEAL
    }));

    // Generate Image in background
    const bg = await generateThemeImage(card.text);
    if (bg) {
        setGeneratedBgImage(bg);
        // Add to history with the image
        setRoundHistory(prev => [
            ...prev, 
            { 
                roundNumber: gameState.currentRound, 
                theme: card.text, 
                source: card.source, 
                imageUrl: bg 
            }
        ]);
    } else {
        // Fallback history without image
        setRoundHistory(prev => [
            ...prev, 
            { 
                roundNumber: gameState.currentRound, 
                theme: card.text, 
                source: card.source
            }
        ]);
    }
  };

  const handleNextRound = () => {
    if (gameState.currentRound >= gameState.totalRounds) {
        setGameState(prev => ({ ...prev, phase: GamePhase.SUMMARY }));
        return;
    }

    setGameState(prev => ({
      ...prev,
      currentRound: prev.currentRound + 1,
      previousTheme: prev.selectedCard?.text || "Next",
      selectedCard: null,
      deck: [],
      participantCards: [],
      phase: GamePhase.ROUND_INPUT
    }));
    
    setGeneratedBgImage(null); // Reset BG for next round
    setParticipantInput(['', '', '', '']);
    setLoadingSingleAI([false, false, false, false]);
  };

  const handleRestart = () => {
    // Reset to initial setup state
    setGameState({
      currentRound: 1,
      totalRounds: 3,
      phase: GamePhase.SETUP,
      roundTitles: {},
      allOrganizerCards: {},
      participantCards: [],
      deck: [],
      selectedCard: null,
      previousTheme: "Start"
    });
    setRoundHistory([]);
    setGeneratedBgImage(null);
    setParticipantInput(['', '', '', '']);
    setLoadingAI(false);
    setLoadingSingleAI([false, false, false, false]);
    // Note: We keep the setupRounds/setupOrganizerInputs/setupTitles in their current modified state
    // so the organizer doesn't have to re-type everything if they just want to restart with same config.
  };

  // --- UI Renderers ---

  const renderSetup = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-800 p-8 rounded-xl border border-amber-500/50 shadow-2xl max-w-2xl w-full my-10 relative">
        <h1 className="text-3xl font-fantasy text-amber-400 mb-6 text-center">遊戲製作接龍 (Game Chain)</h1>
        
        <div className="mb-6">
            <label className="block text-slate-300 text-sm mb-1 font-bold">Total Rounds (輪數)</label>
            <input 
              type="number" 
              min="1"
              max="10"
              value={setupRounds}
              onChange={e => handleRoundsChange(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
            />
        </div>

        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-amber-200 text-lg border-b border-amber-500/30 pb-2">Round Configurations</h3>
            {Array.from({ length: setupRounds }).map((_, i) => {
                const roundNum = i + 1;
                return (
                    <div key={roundNum} className="p-4 bg-slate-900/50 rounded border border-slate-700">
                        <div className="mb-3">
                             <label className="text-xs text-slate-400 uppercase font-bold">Round {roundNum} Title</label>
                             <input 
                                type="text" 
                                placeholder="e.g. Character Style, Environment, Mechanic"
                                value={setupTitles[roundNum] || ""}
                                onChange={e => handleSetupTitleChange(roundNum, e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-amber-100 mt-1"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-500">Org Card 1</label>
                                <input 
                                    type="text" 
                                    value={setupOrganizerInputs[roundNum]?.[0] || ""}
                                    onChange={e => handleOrganizerInputChange(roundNum, 0, e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Org Card 2</label>
                                <input 
                                    type="text" 
                                    value={setupOrganizerInputs[roundNum]?.[1] || ""}
                                    onChange={e => handleOrganizerInputChange(roundNum, 1, e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm"
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        <button 
            onClick={handleSetupSubmit}
            className="w-full mt-6 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded transition-colors shadow-lg shadow-amber-900/20"
          >
            Start Activity (開始活動)
          </button>
      </div>
    </div>
  );

  const renderInputPhase = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
      <div className="bg-slate-800 p-8 rounded-xl border border-blue-500/50 shadow-2xl max-w-lg w-full">
        <h2 className="text-2xl font-fantasy text-blue-400 mb-2 text-center">
          Round {gameState.currentRound} / {gameState.totalRounds}
        </h2>
        <div className="text-center mb-6">
            <h3 className="text-3xl text-white font-bold mb-1">{gameState.roundTitles[gameState.currentRound]}</h3>
            <p className="text-slate-400 text-xs uppercase tracking-widest">Current Theme Title</p>
        </div>
        
        {gameState.currentRound > 1 && (
            <p className="text-slate-400 text-center mb-4 text-sm bg-slate-900/50 py-2 rounded">
                Previous Winner: <span className="text-amber-400 font-bold">{gameState.previousTheme}</span>
            </p>
        )}
        
        <h3 className="text-lg text-white mb-4 border-b border-slate-600 pb-2">Participant Inputs</h3>
        <div className="grid grid-cols-1 gap-3 mb-6">
          {participantInput.map((val, idx) => (
            <div key={idx} className="flex gap-2">
                <input
                    type="text"
                    placeholder={`Idea #${idx + 1}`}
                    value={val}
                    onChange={e => {
                        const newArr = [...participantInput];
                        newArr[idx] = e.target.value;
                        setParticipantInput(newArr);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                />
                <button
                    onClick={() => handleSingleAIGenerate(idx)}
                    disabled={loadingSingleAI[idx]}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white px-3 rounded flex items-center justify-center min-w-[3rem]"
                    title="Auto-generate idea with AI"
                >
                    {loadingSingleAI[idx] ? (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                        "AI"
                    )}
                </button>
            </div>
          ))}
        </div>
        <button 
          onClick={handleParticipantSubmit}
          disabled={participantInput.some(s => !s.trim())}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded transition-colors"
        >
          Submit & Summon AI Cards
        </button>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-md overflow-y-auto p-10 flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-fantasy text-amber-400 mb-8 text-center animate-bounce">
            Game Jam Journey Complete
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-7xl">
            {roundHistory.map((round, idx) => (
                <div 
                    key={round.roundNumber} 
                    className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-600 flex flex-col hover:scale-105 transition-transform duration-300 animate-[fadeIn_0.5s_ease-out_both]"
                    style={{ animationDelay: `${idx * 0.2}s` }}
                >
                    <div className="h-48 w-full bg-slate-900 relative">
                        {round.imageUrl ? (
                            <img src={round.imageUrl} alt={round.theme} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">No Image</div>
                        )}
                        <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded text-xs text-white">
                            Round {round.roundNumber}: {gameState.roundTitles[round.roundNumber]}
                        </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900">
                        <h2 className="text-2xl font-bold text-white mb-2 text-center">{round.theme}</h2>
                        <span className={`text-sm px-3 py-1 rounded-full border ${
                            round.source === CardSource.AI ? "border-purple-500 text-purple-400" :
                            round.source === CardSource.ORGANIZER ? "border-amber-500 text-amber-400" : "border-blue-500 text-blue-400"
                        }`}>
                            {round.source}
                        </span>
                    </div>
                </div>
            ))}
        </div>

        <button 
            onClick={handleRestart}
            className="mt-12 bg-white text-black font-bold py-4 px-10 rounded-full text-xl hover:bg-slate-200 hover:scale-110 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] animate-[pulse_2s_infinite]"
        >
            Start New Jam
        </button>
    </div>
  );

  return (
    <div className="w-full h-screen bg-slate-950 relative overflow-hidden">
      
      {/* BACKGROUND LAYERS */}
      
      {/* 1. Default Static Background (Totem/Field) */}
      {/* Fades out when AI background is active during REVEAL phase */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ 
            backgroundImage: `url(${DEFAULT_BG})`,
            opacity: (gameState.phase === GamePhase.REVEAL && generatedBgImage) ? 0 : 1
        }} 
      />

      {/* 2. AI Generated Background */}
      {/* Fades in to 70% opacity during REVEAL phase */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
        style={{ 
            backgroundImage: generatedBgImage ? `url(${generatedBgImage})` : 'none',
            opacity: (gameState.phase === GamePhase.REVEAL && generatedBgImage) ? 0.7 : 0,
        }} 
      />
      
      {/* UI LAYERS (High Z-index for interactivity) */}
      {gameState.phase === GamePhase.SETUP && renderSetup()}
      {gameState.phase === GamePhase.ROUND_INPUT && renderInputPhase()}
      {gameState.phase === GamePhase.SUMMARY && renderSummary()}
      
      {/* Loading Overlay */}
      {gameState.phase === GamePhase.GENERATING && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-[60] text-white pointer-events-none">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
            <p className="font-fantasy text-xl animate-pulse">Consulting the Cyber Spirits...</p>
         </div>
      )}

      {/* Preview Overlay */}
      {gameState.phase === GamePhase.PREVIEW && (
         <div className="absolute top-10 left-0 right-0 z-[60] flex justify-center pointer-events-none animate-bounce">
            <div className="bg-black/60 px-8 py-3 rounded-full border border-amber-400/50 backdrop-blur-md shadow-lg shadow-amber-500/20">
                <p className="text-amber-300 font-fantasy text-2xl tracking-wider">Theme Preview (預覽題目)</p>
            </div>
         </div>
      )}

      {/* Result Overlay - SUPER High Z-index (100) to fix clickable issue */}
      {gameState.phase === GamePhase.REVEAL && gameState.selectedCard && (
        <div className="absolute bottom-10 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none animate-[fadeIn_1s_ease-in]">
             <div className="bg-black/80 p-8 rounded-xl backdrop-blur-md text-center pointer-events-auto border border-amber-500/30 shadow-[0_0_30px_rgba(251,191,36,0.2)]">
                <p className="text-slate-300 text-sm uppercase tracking-widest mb-2 font-sans">Selected Theme</p>
                <h1 className="text-5xl md:text-7xl font-fantasy text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-600 mb-4 drop-shadow-sm">
                    {gameState.selectedCard.text}
                </h1>
                <div className="inline-block px-3 py-1 bg-slate-800 rounded-full mb-8 border border-slate-600">
                    <p className="text-xs text-slate-400">Source: <span className={
                        gameState.selectedCard.source === CardSource.AI ? "text-purple-400" :
                        gameState.selectedCard.source === CardSource.ORGANIZER ? "text-amber-400" : "text-blue-400"
                    }>{gameState.selectedCard.source}</span></p>
                </div>
                <div>
                    <button 
                        onClick={handleNextRound}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-10 py-3 rounded-full transition-all font-sans font-bold hover:scale-105 hover:bg-amber-500/20 cursor-pointer relative z-50"
                    >
                        {gameState.currentRound >= gameState.totalRounds ? "Finish Game Jam" : "Next Round →"}
                    </button>
                </div>
             </div>
        </div>
      )}

      {/* 3D Scene - Z-10 to sit above BG but below UI */}
      <div className="absolute inset-0 z-10 pointer-events-auto">
        <Canvas camera={{ position: [0, 0, 9], fov: 45 }} gl={{ alpha: true }}>
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 10, 10]} intensity={1} color="#fbbf24" />
            <pointLight position={[-10, -5, 5]} intensity={0.5} color="#3b82f6" />
            <Stars radius={80} depth={50} count={6000} factor={4} saturation={0} fade speed={0.5} />
            
            {(gameState.phase === GamePhase.SHUFFLING || 
            gameState.phase === GamePhase.SELECTION || 
            gameState.phase === GamePhase.REVEAL || 
            gameState.phase === GamePhase.PREVIEW) && (
                <CardDeck 
                    cards={gameState.deck} 
                    phase={gameState.phase} 
                    onCardSelect={handleCardSelect}
                />
            )}

            {/* Particle Text - Lifted Up */}
            {/* Condition: Show only in Reveal phase, but STOP showing if the generated BG image has loaded */}
            {gameState.phase === GamePhase.REVEAL && gameState.selectedCard && !generatedBgImage && (
                <group position={[0, 2, 0]}>
                    <ParticleText 
                        text={gameState.selectedCard.text} 
                        previousText={gameState.previousTheme}
                    />
                </group>
            )}
        </Canvas>
      </div>
    </div>
  );
};

export default App;