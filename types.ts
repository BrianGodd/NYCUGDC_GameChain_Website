export enum CardSource {
  PARTICIPANT = 'PARTICIPANT',
  ORGANIZER = 'ORGANIZER',
  AI = 'AI'
}

export interface CardData {
  id: string;
  text: string;
  source: CardSource;
}

export enum GamePhase {
  SETUP = 'SETUP',          // Organizer inputs 2 cards
  ROUND_INPUT = 'ROUND_INPUT', // Participants input 4 cards
  GENERATING = 'GENERATING',   // AI generating 2 cards
  PREVIEW = 'PREVIEW',         // Show cards face up
  SHUFFLING = 'SHUFFLING',     // 3D Shuffle animation
  SELECTION = 'SELECTION',     // User picks a card
  REVEAL = 'REVEAL',           // Particle morph & Result
  SUMMARY = 'SUMMARY'          // Final gallery
}

export interface RoundRecord {
  roundNumber: number;
  theme: string;
  source: CardSource;
  imageUrl?: string;
}

export interface GameState {
  currentRound: number;
  totalRounds: number;
  phase: GamePhase;
  roundTitles: Record<number, string>; // Title/Topic for each round
  allOrganizerCards: Record<number, string[]>; // Store cards for each round
  participantCards: string[]; // 4 cards for current round
  deck: CardData[];
  selectedCard: CardData | null;
  previousTheme: string;
}