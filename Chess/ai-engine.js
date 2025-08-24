class AIEngine {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.maxDepth = this.getMaxDepth(difficulty);
        this.positionCache = new Map();
        this.transpositionTable = new Map();
        this.killerMoves = Array(10).fill(null).map(() => []);
        this.historyTable = new Map();
        this.nodesSearched = 0;

        // Enhanced piece values with positional considerations
        this.pieceValues = {
            'pawn': 100,
            'knight': 320,
            'bishop': 330,
            'rook': 500,
            'queen': 900,
            'king': 20000
        };

        this.initializeEvaluationTables();
        this.initializeOpeningBook();
    }

    getMaxDepth(difficulty) {
        switch (difficulty) {
            case 'easy': return 2;
            case 'medium': return 4;
            case 'hard': return 6;
            case 'insane': return 8;
            case 'grandmaster': return 10;
            case 'superhuman': return 12;
            default: return 4;
        }
    }

    initializeEvaluationTables() {
        // Pawn evaluation table (white perspective)
        this.pawnTable = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [50, 50, 50, 50, 50, 50, 50, 50],
            [10, 10, 20, 30, 30, 20, 10, 10],
            [5, 5, 10, 27, 27, 10, 5, 5],
            [0, 0, 0, 25, 25, 0, 0, 0],
            [5, -5, -10, 0, 0, -10, -5, 5],
            [5, 10, 10, -25, -25, 10, 10, 5],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ];

        // Knight evaluation table
        this.knightTable = [
            [-50, -40, -30, -30, -30, -30, -40, -50],
            [-40, -20, 0, 0, 0, 0, -20, -40],
            [-30, 0, 10, 15, 15, 10, 0, -30],
            [-30, 5, 15, 20, 20, 15, 5, -30],
            [-30, 0, 15, 20, 20, 15, 0, -30],
            [-30, 5, 10, 15, 15, 10, 5, -30],
            [-40, -20, 0, 5, 5, 0, -20, -40],
            [-50, -40, -30, -30, -30, -30, -40, -50]
        ];

        // Bishop evaluation table
        this.bishopTable = [
            [-20, -10, -10, -10, -10, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 10, 10, 5, 0, -10],
            [-10, 5, 5, 10, 10, 5, 5, -10],
            [-10, 0, 10, 10, 10, 10, 0, -10],
            [-10, 10, 10, 10, 10, 10, 10, -10],
            [-10, 5, 0, 0, 0, 0, 5, -10],
            [-20, -10, -10, -10, -10, -10, -10, -20]
        ];

        // Rook evaluation table
        this.rookTable = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [5, 10, 10, 10, 10, 10, 10, 5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [-5, 0, 0, 0, 0, 0, 0, -5],
            [0, 0, 0, 5, 5, 0, 0, 0]
        ];

        // Queen evaluation table
        this.queenTable = [
            [-20, -10, -10, -5, -5, -10, -10, -20],
            [-10, 0, 0, 0, 0, 0, 0, -10],
            [-10, 0, 5, 5, 5, 5, 0, -10],
            [-5, 0, 5, 5, 5, 5, 0, -5],
            [0, 0, 5, 5, 5, 5, 0, -5],
            [-10, 5, 5, 5, 5, 5, 0, -10],
            [-10, 0, 5, 0, 0, 0, 0, -10],
            [-20, -10, -10, -5, -5, -10, -10, -20]
        ];

        // King middle game table
        this.kingMidTable = [
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-30, -40, -40, -50, -50, -40, -40, -30],
            [-20, -30, -30, -40, -40, -30, -30, -20],
            [-10, -20, -20, -20, -20, -20, -20, -10],
            [20, 20, 0, 0, 0, 0, 20, 20],
            [20, 30, 10, 0, 0, 10, 30, 20]
        ];

        // King endgame table
        this.kingEndTable = [
            [-50, -40, -30, -20, -20, -30, -40, -50],
            [-30, -20, -10, 0, 0, -10, -20, -30],
            [-30, -10, 20, 30, 30, 20, -10, -30],
            [-30, -10, 30, 40, 40, 30, -10, -30],
            [-30, -10, 30, 40, 40, 30, -10, -30],
            [-30, -10, 20, 30, 30, 20, -10, -30],
            [-30, -30, 0, 0, 0, 0, -30, -30],
            [-50, -30, -30, -30, -30, -30, -30, -50]
        ];
    }

    initializeOpeningBook() {
        this.openingBook = {
            // Starting position moves for white (weighted by difficulty)
            'start': [
                { from: [6, 4], to: [4, 4], name: 'King\'s Pawn', weight: 10 },      // e4
                { from: [6, 3], to: [4, 3], name: 'Queen\'s Pawn', weight: 10 },     // d4
                { from: [7, 6], to: [5, 5], name: 'King\'s Knight', weight: 8 },     // Nf3
                { from: [7, 1], to: [5, 2], name: 'Queen\'s Knight', weight: 6 },    // Nc3
                { from: [6, 2], to: [4, 2], name: 'English Opening', weight: 7 }     // c4
            ],
            // Responses to e4
            'e4_responses': [
                { from: [1, 4], to: [3, 4], name: 'King\'s Pawn Defense', weight: 10 }, // e5
                { from: [1, 2], to: [3, 2], name: 'Sicilian Defense', weight: 9 },      // c5
                { from: [1, 4], to: [2, 4], name: 'French Defense', weight: 7 },        // e6
                { from: [1, 6], to: [2, 6], name: 'Caro-Kann Defense', weight: 6 },    // c6
                { from: [0, 6], to: [2, 5], name: 'Alekhine Defense', weight: 5 }      // Nf6
            ],
            // Responses to d4
            'd4_responses': [
                { from: [1, 3], to: [3, 3], name: 'Queen\'s Pawn Defense', weight: 10 }, // d5
                { from: [0, 6], to: [2, 5], name: 'King\'s Indian Defense', weight: 9 }, // Nf6
                { from: [1, 6], to: [2, 6], name: 'King\'s Indian Setup', weight: 7 },   // g6
                { from: [1, 5], to: [2, 5], name: 'Nimzo-Indian Setup', weight: 8 }      // f5
            ],
            // Advanced opening lines for higher difficulties
            'sicilian_lines': [
                { from: [7, 6], to: [5, 5], name: 'Open Sicilian', weight: 10 },        // Nf3
                { from: [7, 1], to: [5, 2], name: 'Closed Sicilian', weight: 8 }        // Nc3
            ],
            'french_lines': [
                { from: [1, 3], to: [3, 3], name: 'French Advance', weight: 9 },        // d5
                { from: [0, 1], to: [2, 2], name: 'French Classical', weight: 8 }       // Nc6
            ]
        };
    }

    async getBestMove(chessEngine) {
        const startTime = Date.now();
        this.nodesSearched = 0;

        // Clear caches if they get too large
        if (this.transpositionTable.size > 50000) {
            this.transpositionTable.clear();
        }

        const allMoves = chessEngine.getAllValidMoves(chessEngine.currentPlayer);
        if (allMoves.length === 0) return null;
        if (allMoves.length === 1) return allMoves[0];

        // Opening book for early game (extended for higher difficulties)
        const maxBookMoves = this.getMaxBookMoves();
        if (chessEngine.gameHistory.length < maxBookMoves) {
            const bookMove = this.getOpeningBookMove(chessEngine);
            if (bookMove) return bookMove;
        }

        let bestMove = allMoves[0];
        let bestScore = -Infinity;
        const timeLimit = this.getTimeLimit();

        try {
            // Iterative deepening with aspiration windows
            let alpha = -Infinity;
            let beta = Infinity;

            for (let depth = 1; depth <= this.maxDepth; depth++) {
                if (Date.now() - startTime > timeLimit) break;

                // Aspiration window search for deeper depths
                if (depth >= 4) {
                    alpha = bestScore - 50;
                    beta = bestScore + 50;
                }

                const result = await this.alphaBetaSearch(chessEngine, depth, alpha, beta, true, startTime, timeLimit);

                if (result && result.move) {
                    bestMove = result.move;
                    bestScore = result.score;

                    // If we found a mate, stop searching
                    if (Math.abs(bestScore) > 9000) break;
                }

                // Re-search with wider window if we fell outside aspiration window
                if (bestScore <= alpha || bestScore >= beta) {
                    const wideResult = await this.alphaBetaSearch(chessEngine, depth, -Infinity, Infinity, true, startTime, timeLimit);
                    if (wideResult && wideResult.move) {
                        bestMove = wideResult.move;
                        bestScore = wideResult.score;
                    }
                }
            }
        } catch (error) {
            console.log(`AI search completed: ${this.nodesSearched} nodes in ${Date.now() - startTime}ms`);
        }

        return bestMove;
    }

    getTimeLimit() {
        switch (this.difficulty) {
            case 'easy': return 300;
            case 'medium': return 1000;
            case 'hard': return 2500;
            case 'insane': return 5000;
            case 'grandmaster': return 8000;
            case 'superhuman': return 12000;
            default: return 1000;
        }
    }

    async alphaBetaSearch(chessEngine, depth, alpha, beta, maximizingPlayer, startTime, timeLimit) {
        this.nodesSearched++;

        // Check time limit every 1000 nodes
        if (this.nodesSearched % 1000 === 0 && Date.now() - startTime > timeLimit) {
            throw new Error('Time limit exceeded');
        }

        // Check transposition table
        const posKey = this.getPositionKey(chessEngine);
        const ttEntry = this.transpositionTable.get(posKey);
        if (ttEntry && ttEntry.depth >= depth) {
            if (ttEntry.flag === 'EXACT') return { score: ttEntry.score, move: ttEntry.move };
            if (ttEntry.flag === 'LOWERBOUND') alpha = Math.max(alpha, ttEntry.score);
            if (ttEntry.flag === 'UPPERBOUND') beta = Math.min(beta, ttEntry.score);
            if (alpha >= beta) return { score: ttEntry.score, move: ttEntry.move };
        }

        // Terminal node evaluation
        if (depth === 0) {
            const score = this.quiescenceSearch(chessEngine, alpha, beta, 4, startTime, timeLimit);
            return { score, move: null };
        }

        if (chessEngine.isGameOver) {
            if (chessEngine.winner === 'white') return { score: 10000 - (this.maxDepth - depth), move: null };
            if (chessEngine.winner === 'black') return { score: -10000 + (this.maxDepth - depth), move: null };
            return { score: 0, move: null };
        }

        const moves = chessEngine.getAllValidMoves(chessEngine.currentPlayer);
        if (moves.length === 0) {
            const score = chessEngine.isInCheck(chessEngine.currentPlayer) ?
                (maximizingPlayer ? -10000 : 10000) : 0;
            return { score, move: null };
        }

        // Advanced move ordering
        this.orderMovesAdvanced(moves, chessEngine, depth);

        let bestMove = null;
        let bestScore = maximizingPlayer ? -Infinity : Infinity;
        let alphaOrig = alpha;

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];

            if (Date.now() - startTime > timeLimit) break;

            const clonedEngine = chessEngine.clone();
            clonedEngine.makeMove(move.from[0], move.from[1], move.to[0], move.to[1]);

            let score;

            // Principal Variation Search (PVS)
            if (i === 0) {
                const result = await this.alphaBetaSearch(clonedEngine, depth - 1, -beta, -alpha, !maximizingPlayer, startTime, timeLimit);
                score = -result.score;
            } else {
                // Null window search
                const result = await this.alphaBetaSearch(clonedEngine, depth - 1, -alpha - 1, -alpha, !maximizingPlayer, startTime, timeLimit);
                score = -result.score;

                // Re-search if necessary
                if (score > alpha && score < beta) {
                    const fullResult = await this.alphaBetaSearch(clonedEngine, depth - 1, -beta, -alpha, !maximizingPlayer, startTime, timeLimit);
                    score = -fullResult.score;
                }
            }

            if (maximizingPlayer) {
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, score);
            } else {
                if (score < bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                beta = Math.min(beta, score);
            }

            // Alpha-beta cutoff
            if (beta <= alpha) {
                // Store killer move
                if (!this.killerMoves[depth].includes(move)) {
                    this.killerMoves[depth].unshift(move);
                    if (this.killerMoves[depth].length > 2) {
                        this.killerMoves[depth].pop();
                    }
                }
                break;
            }
        }

        // Store in transposition table
        let flag = 'EXACT';
        if (bestScore <= alphaOrig) flag = 'UPPERBOUND';
        else if (bestScore >= beta) flag = 'LOWERBOUND';

        this.transpositionTable.set(posKey, {
            depth: depth,
            score: bestScore,
            flag: flag,
            move: bestMove
        });

        return { score: bestScore, move: bestMove };
    }

    quiescenceSearch(chessEngine, alpha, beta, depth, startTime, timeLimit) {
        if (depth === 0 || Date.now() - startTime > timeLimit) {
            return this.evaluatePosition(chessEngine);
        }

        const standPat = this.evaluatePosition(chessEngine);

        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;

        // Only consider captures and checks in quiescence search
        const moves = chessEngine.getAllValidMoves(chessEngine.currentPlayer);
        const captureMoves = moves.filter(move => {
            const target = chessEngine.board[move.to[0]][move.to[1]];
            return target !== null; // Only captures
        });

        for (let move of captureMoves) {
            const clonedEngine = chessEngine.clone();
            clonedEngine.makeMove(move.from[0], move.from[1], move.to[0], move.to[1]);

            const score = -this.quiescenceSearch(clonedEngine, -beta, -alpha, depth - 1, startTime, timeLimit);

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    orderMovesAdvanced(moves, chessEngine, depth) {
        moves.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // 1. Hash move (from transposition table)
            const ttEntry = this.transpositionTable.get(this.getPositionKey(chessEngine));
            if (ttEntry && ttEntry.move) {
                if (this.movesEqual(a, ttEntry.move)) scoreA += 10000;
                if (this.movesEqual(b, ttEntry.move)) scoreB += 10000;
            }

            // 2. Captures (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
            const captureA = chessEngine.board[a.to[0]][a.to[1]];
            const captureB = chessEngine.board[b.to[0]][b.to[1]];
            const attackerA = chessEngine.board[a.from[0]][a.from[1]];
            const attackerB = chessEngine.board[b.from[0]][b.from[1]];

            if (captureA) scoreA += this.pieceValues[captureA.type] - this.pieceValues[attackerA.type] / 10;
            if (captureB) scoreB += this.pieceValues[captureB.type] - this.pieceValues[attackerB.type] / 10;

            // 3. Killer moves
            if (this.killerMoves[depth]) {
                if (this.killerMoves[depth].some(killer => this.movesEqual(a, killer))) scoreA += 900;
                if (this.killerMoves[depth].some(killer => this.movesEqual(b, killer))) scoreB += 900;
            }

            // 4. History heuristic
            const historyA = this.historyTable.get(this.getMoveKey(a)) || 0;
            const historyB = this.historyTable.get(this.getMoveKey(b)) || 0;
            scoreA += historyA;
            scoreB += historyB;

            // 5. Positional factors
            scoreA += this.getMovePositionalScore(a, chessEngine);
            scoreB += this.getMovePositionalScore(b, chessEngine);

            return scoreB - scoreA;
        });
    }

    getMovePositionalScore(move, chessEngine) {
        let score = 0;
        const piece = chessEngine.board[move.from[0]][move.from[1]];

        // Center control
        if (this.isCenterSquare(move.to[0], move.to[1])) score += 20;

        // Piece development
        if (this.isDevelopmentMove(piece, move.from, move.to)) score += 15;

        // Castling
        if (piece.type === 'king' && Math.abs(move.to[1] - move.from[1]) === 2) score += 50;

        // Pawn promotion
        if (piece.type === 'pawn' && (move.to[0] === 0 || move.to[0] === 7)) score += 800;

        return score;
    }

    evaluatePosition(chessEngine) {
        if (chessEngine.isGameOver) {
            if (chessEngine.winner === 'white') return 10000;
            if (chessEngine.winner === 'black') return -10000;
            return 0;
        }

        let score = 0;
        let whiteKingPos = null;
        let blackKingPos = null;
        let materialCount = 0;

        // Material and positional evaluation
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece) {
                    materialCount++;
                    let pieceScore = this.pieceValues[piece.type];

                    // Positional bonus
                    pieceScore += this.getPositionalValue(piece, row, col, materialCount < 16);

                    // Advanced evaluation for higher difficulties
                    if (this.difficulty === 'hard' || this.difficulty === 'insane' ||
                        this.difficulty === 'grandmaster' || this.difficulty === 'superhuman') {
                        pieceScore += this.getAdvancedPieceEvaluation(chessEngine, piece, row, col);
                    }

                    // Master-level evaluation for highest difficulties
                    if (this.difficulty === 'grandmaster' || this.difficulty === 'superhuman') {
                        pieceScore += this.getMasterLevelEvaluation(chessEngine, piece, row, col);
                    }

                    score += piece.color === 'white' ? pieceScore : -pieceScore;

                    // Track king positions
                    if (piece.type === 'king') {
                        if (piece.color === 'white') whiteKingPos = [row, col];
                        else blackKingPos = [row, col];
                    }
                }
            }
        }

        // Strategic evaluation for higher difficulties
        if (this.difficulty === 'insane' || this.difficulty === 'grandmaster' || this.difficulty === 'superhuman') {
            score += this.evaluateKingSafety(chessEngine, whiteKingPos, blackKingPos);
            score += this.evaluatePawnStructure(chessEngine);
            score += this.evaluatePieceMobility(chessEngine);
            score += this.evaluateTacticalThemes(chessEngine);

            // Master-level strategic evaluation
            if (this.difficulty === 'grandmaster' || this.difficulty === 'superhuman') {
                score += this.evaluateAdvancedStrategy(chessEngine);
                score += this.evaluateEndgameKnowledge(chessEngine, materialCount);
                score += this.evaluatePositionalConcepts(chessEngine);
            }

            // Superhuman-level evaluation
            if (this.difficulty === 'superhuman') {
                score += this.evaluateSuperhuman(chessEngine);
            }
        }

        return score;
    }

    getPositionalValue(piece, row, col, isEndgame) {
        const adjustedRow = piece.color === 'white' ? 7 - row : row;

        switch (piece.type) {
            case 'pawn':
                return this.pawnTable[adjustedRow][col];
            case 'knight':
                return this.knightTable[adjustedRow][col];
            case 'bishop':
                return this.bishopTable[adjustedRow][col];
            case 'rook':
                return this.rookTable[adjustedRow][col];
            case 'queen':
                return this.queenTable[adjustedRow][col];
            case 'king':
                return isEndgame ? this.kingEndTable[adjustedRow][col] : this.kingMidTable[adjustedRow][col];
            default:
                return 0;
        }
    }

    getAdvancedPieceEvaluation(chessEngine, piece, row, col) {
        let bonus = 0;

        // Piece mobility
        const moves = chessEngine.getPossibleMoves(row, col);
        bonus += moves.length * 3;

        // Piece safety
        const isAttacked = chessEngine.isSquareAttacked(row, col, piece.color === 'white' ? 'black' : 'white');
        const isDefended = chessEngine.isSquareAttacked(row, col, piece.color);

        if (isAttacked && !isDefended) {
            bonus -= this.pieceValues[piece.type] / 8;
        } else if (isDefended) {
            bonus += 5;
        }

        // Piece-specific bonuses
        switch (piece.type) {
            case 'bishop':
                // Bishop pair bonus
                if (this.hasBishopPair(chessEngine, piece.color)) bonus += 30;
                break;
            case 'rook':
                // Rook on open file
                if (this.isOpenFile(chessEngine, col)) bonus += 25;
                // Rook on 7th rank
                if ((piece.color === 'white' && row === 1) || (piece.color === 'black' && row === 6)) {
                    bonus += 20;
                }
                break;
            case 'knight':
                // Knight outposts
                if (this.isKnightOutpost(chessEngine, row, col, piece.color)) bonus += 25;
                break;
        }

        return bonus;
    }

    evaluateTacticalThemes(chessEngine) {
        let score = 0;

        // Look for tactical patterns
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece) {
                    // Check for pins
                    if (this.isPinned(chessEngine, row, col, piece.color)) {
                        score += piece.color === 'white' ? -15 : 15;
                    }

                    // Check for forks
                    const forkTargets = this.getForkTargets(chessEngine, row, col, piece);
                    if (forkTargets.length >= 2) {
                        score += piece.color === 'white' ? 30 : -30;
                    }

                    // Check for discovered attacks
                    if (this.hasDiscoveredAttack(chessEngine, row, col, piece)) {
                        score += piece.color === 'white' ? 20 : -20;
                    }
                }
            }
        }

        return score;
    }

    // Tactical pattern detection methods
    isPinned(chessEngine, row, col, color) {
        // Simplified pin detection
        const directions = [
            [0, 1], [0, -1], [1, 0], [-1, 0],  // Rook directions
            [1, 1], [1, -1], [-1, 1], [-1, -1] // Bishop directions
        ];

        for (let [dr, dc] of directions) {
            let blocker = null;
            let attacker = null;

            // Check in one direction
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;

                if (!chessEngine.isValidSquare(newRow, newCol)) break;

                const piece = chessEngine.board[newRow][newCol];
                if (piece) {
                    if (piece.color === color) {
                        if (!blocker) blocker = piece;
                        else break;
                    } else {
                        attacker = piece;
                        break;
                    }
                }
            }

            if (blocker && attacker) {
                // Check if attacker can actually pin
                const canPin = (Math.abs(dr) === Math.abs(dc) && (attacker.type === 'bishop' || attacker.type === 'queen')) ||
                    (dr === 0 || dc === 0) && (attacker.type === 'rook' || attacker.type === 'queen');
                if (canPin) return true;
            }
        }

        return false;
    }

    getForkTargets(chessEngine, row, col, piece) {
        if (piece.type !== 'knight') return [];

        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        const targets = [];
        for (let [dr, dc] of knightMoves) {
            const newRow = row + dr;
            const newCol = col + dc;

            if (chessEngine.isValidSquare(newRow, newCol)) {
                const target = chessEngine.board[newRow][newCol];
                if (target && target.color !== piece.color &&
                    (target.type === 'king' || target.type === 'queen' || target.type === 'rook')) {
                    targets.push(target);
                }
            }
        }

        return targets;
    }

    hasDiscoveredAttack(chessEngine, row, col, piece) {
        // Simplified discovered attack detection
        return false; // Placeholder for complex logic
    }

    // Helper methods
    hasBishopPair(chessEngine, color) {
        let bishopCount = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.type === 'bishop' && piece.color === color) {
                    bishopCount++;
                }
            }
        }
        return bishopCount >= 2;
    }

    isOpenFile(chessEngine, col) {
        for (let row = 0; row < 8; row++) {
            const piece = chessEngine.board[row][col];
            if (piece && piece.type === 'pawn') return false;
        }
        return true;
    }

    isKnightOutpost(chessEngine, row, col, color) {
        // Check if knight is on an outpost (protected by pawn, can't be attacked by enemy pawns)
        const direction = color === 'white' ? 1 : -1;

        // Check for pawn support
        const supportSquares = [[row + direction, col - 1], [row + direction, col + 1]];
        let hasSupport = false;

        for (let [r, c] of supportSquares) {
            if (chessEngine.isValidSquare(r, c)) {
                const piece = chessEngine.board[r][c];
                if (piece && piece.type === 'pawn' && piece.color === color) {
                    hasSupport = true;
                    break;
                }
            }
        }

        return hasSupport;
    }

    evaluateKingSafety(chessEngine, whiteKingPos, blackKingPos) {
        let score = 0;

        if (whiteKingPos) {
            score += this.getKingSafetyScore(chessEngine, whiteKingPos, 'white');
        }
        if (blackKingPos) {
            score -= this.getKingSafetyScore(chessEngine, blackKingPos, 'black');
        }

        return score;
    }

    getKingSafetyScore(chessEngine, kingPos, color) {
        let safety = 0;
        const [kingRow, kingCol] = kingPos;

        // Pawn shield
        const direction = color === 'white' ? -1 : 1;
        for (let col = Math.max(0, kingCol - 1); col <= Math.min(7, kingCol + 1); col++) {
            const pawnRow = kingRow + direction;
            if (chessEngine.isValidSquare(pawnRow, col)) {
                const piece = chessEngine.board[pawnRow][col];
                if (piece && piece.type === 'pawn' && piece.color === color) {
                    safety += 10;
                }
            }
        }

        // King exposure penalty
        const attackingMoves = chessEngine.getAllValidMoves(color === 'white' ? 'black' : 'white');
        const attacksNearKing = attackingMoves.filter(move =>
            Math.abs(move.to[0] - kingRow) <= 2 && Math.abs(move.to[1] - kingCol) <= 2
        );
        safety -= attacksNearKing.length * 5;

        return safety;
    }

    evaluatePawnStructure(chessEngine) {
        let score = 0;

        for (let color of ['white', 'black']) {
            const pawns = this.getPawns(chessEngine, color);
            let colorScore = 0;

            for (let pawn of pawns) {
                // Doubled pawns penalty
                const sameFile = pawns.filter(p => p[1] === pawn[1]);
                if (sameFile.length > 1) colorScore -= 10;

                // Isolated pawns penalty
                const hasSupport = pawns.some(p =>
                    Math.abs(p[1] - pawn[1]) === 1
                );
                if (!hasSupport) colorScore -= 15;

                // Passed pawns bonus
                if (this.isPassedPawn(chessEngine, pawn[0], pawn[1], color)) {
                    const rank = color === 'white' ? 7 - pawn[0] : pawn[0];
                    colorScore += 20 + rank * 10;
                }

                // Backward pawns penalty
                if (this.isBackwardPawn(chessEngine, pawn[0], pawn[1], color)) {
                    colorScore -= 12;
                }
            }

            score += color === 'white' ? colorScore : -colorScore;
        }

        return score;
    }

    evaluatePieceMobility(chessEngine) {
        let score = 0;

        const whiteMobility = this.calculateMobility(chessEngine, 'white');
        const blackMobility = this.calculateMobility(chessEngine, 'black');

        score += (whiteMobility - blackMobility) * 2;

        return score;
    }

    calculateMobility(chessEngine, color) {
        let mobility = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.color === color && piece.type !== 'king') {
                    const moves = chessEngine.getPossibleMoves(row, col);
                    mobility += moves.length;
                }
            }
        }

        return mobility;
    }

    getPawns(chessEngine, color) {
        const pawns = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.type === 'pawn' && piece.color === color) {
                    pawns.push([row, col]);
                }
            }
        }
        return pawns;
    }

    isPassedPawn(chessEngine, row, col, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = row + direction;
        const endRow = color === 'white' ? 0 : 7;

        for (let r = startRow; r !== endRow + direction; r += direction) {
            for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
                const piece = chessEngine.board[r][c];
                if (piece && piece.type === 'pawn' && piece.color !== color) {
                    return false;
                }
            }
        }

        return true;
    }

    isBackwardPawn(chessEngine, row, col, color) {
        const direction = color === 'white' ? 1 : -1;

        // Check if pawn can't advance safely and has no pawn support
        const advanceSquare = [row - direction, col];
        if (chessEngine.isValidSquare(advanceSquare[0], advanceSquare[1])) {
            if (chessEngine.isSquareAttacked(advanceSquare[0], advanceSquare[1], color === 'white' ? 'black' : 'white')) {
                // Check for pawn support
                const supportSquares = [[row + direction, col - 1], [row + direction, col + 1]];
                for (let [r, c] of supportSquares) {
                    if (chessEngine.isValidSquare(r, c)) {
                        const piece = chessEngine.board[r][c];
                        if (piece && piece.type === 'pawn' && piece.color === color) {
                            return false;
                        }
                    }
                }
                return true; // No pawn support found
            }
        }
        return false;
    }

    getOpeningBookMove(chessEngine) {
        const history = chessEngine.gameHistory;
        const validMoves = chessEngine.getAllValidMoves(chessEngine.currentPlayer);

        // Extend opening book usage for higher difficulties
        const maxBookMoves = this.getMaxBookMoves();
        if (history.length >= maxBookMoves) return null;

        // First move for white
        if (history.length === 0 && chessEngine.currentPlayer === 'white') {
            return this.selectWeightedMove(this.openingBook.start, validMoves);
        }

        // Black's response to white's first move
        if (history.length === 1 && chessEngine.currentPlayer === 'black') {
            const lastMove = history[0];
            if (lastMove.to[0] === 4 && lastMove.to[1] === 4) { // e4
                return this.selectWeightedMove(this.openingBook.e4_responses, validMoves);
            } else if (lastMove.to[0] === 4 && lastMove.to[1] === 3) { // d4
                return this.selectWeightedMove(this.openingBook.d4_responses, validMoves);
            }
        }

        // Extended opening lines for higher difficulties
        if (this.difficulty === 'grandmaster' || this.difficulty === 'superhuman') {
            return this.getAdvancedOpeningMove(chessEngine, history, validMoves);
        }

        return null;
    }

    getMaxBookMoves() {
        switch (this.difficulty) {
            case 'easy': return 4;
            case 'medium': return 6;
            case 'hard': return 8;
            case 'insane': return 10;
            case 'grandmaster': return 12;
            case 'superhuman': return 16;
            default: return 6;
        }
    }

    selectWeightedMove(bookMoves, validMoves) {
        const validBookMoves = bookMoves.filter(bookMove =>
            validMoves.some(validMove =>
                validMove.from[0] === bookMove.from[0] &&
                validMove.from[1] === bookMove.from[1] &&
                validMove.to[0] === bookMove.to[0] &&
                validMove.to[1] === bookMove.to[1]
            )
        );

        if (validBookMoves.length === 0) return null;

        // For higher difficulties, use weighted selection
        if (this.difficulty === 'grandmaster' || this.difficulty === 'superhuman') {
            const totalWeight = validBookMoves.reduce((sum, move) => sum + (move.weight || 1), 0);
            let random = Math.random() * totalWeight;

            for (let move of validBookMoves) {
                random -= (move.weight || 1);
                if (random <= 0) return move;
            }
        }

        // Random selection for lower difficulties
        return validBookMoves[Math.floor(Math.random() * validBookMoves.length)];
    }

    getAdvancedOpeningMove(chessEngine, history, validMoves) {
        // Analyze position and select principled opening moves
        if (history.length >= 2) {
            // Look for specific opening patterns
            const pattern = this.identifyOpeningPattern(history);

            switch (pattern) {
                case 'sicilian':
                    return this.selectWeightedMove(this.openingBook.sicilian_lines || [], validMoves);
                case 'french':
                    return this.selectWeightedMove(this.openingBook.french_lines || [], validMoves);
                default:
                    return this.selectPrincipledMove(chessEngine, validMoves);
            }
        }

        return null;
    }

    identifyOpeningPattern(history) {
        if (history.length >= 2) {
            const firstMove = history[0];
            const secondMove = history[1];

            // Sicilian Defense: 1.e4 c5
            if (firstMove.to[0] === 4 && firstMove.to[1] === 4 &&
                secondMove.to[0] === 3 && secondMove.to[1] === 2) {
                return 'sicilian';
            }

            // French Defense: 1.e4 e6
            if (firstMove.to[0] === 4 && firstMove.to[1] === 4 &&
                secondMove.to[0] === 2 && secondMove.to[1] === 4) {
                return 'french';
            }
        }

        return 'unknown';
    }

    selectPrincipledMove(chessEngine, validMoves) {
        // Select moves based on opening principles
        let bestMoves = [];
        let bestScore = -Infinity;

        for (let move of validMoves) {
            let score = 0;
            const piece = chessEngine.board[move.from[0]][move.from[1]];

            // Development bonus
            if (this.isDevelopmentMove(piece, move.from, move.to)) {
                score += 20;
            }

            // Center control
            if (this.isCenterSquare(move.to[0], move.to[1])) {
                score += 15;
            }

            // Castling preparation
            if (piece.type === 'king' && Math.abs(move.to[1] - move.from[1]) === 2) {
                score += 25;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        return bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
    }

    // Utility methods
    movesEqual(move1, move2) {
        return move1.from[0] === move2.from[0] && move1.from[1] === move2.from[1] &&
            move1.to[0] === move2.to[0] && move1.to[1] === move2.to[1];
    }

    getMoveKey(move) {
        return `${move.from[0]},${move.from[1]}-${move.to[0]},${move.to[1]}`;
    }

    isCenterSquare(row, col) {
        return (row >= 3 && row <= 4) && (col >= 3 && col <= 4);
    }

    isDevelopmentMove(piece, from, to) {
        if (!piece || (piece.type !== 'knight' && piece.type !== 'bishop')) return false;

        if (piece.color === 'white' && from[0] === 7) return true;
        if (piece.color === 'black' && from[0] === 0) return true;

        return false;
    }

    getPositionKey(chessEngine) {
        let key = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece) {
                    key += piece.color[0] + piece.type[0];
                } else {
                    key += '-';
                }
            }
        }
        key += chessEngine.currentPlayer[0];
        key += chessEngine.castlingRights.white.kingside ? 'K' : '';
        key += chessEngine.castlingRights.white.queenside ? 'Q' : '';
        key += chessEngine.castlingRights.black.kingside ? 'k' : '';
        key += chessEngine.castlingRights.black.queenside ? 'q' : '';
        return key;
    }

    // Master-level piece evaluation
    getMasterLevelEvaluation(chessEngine, piece, row, col) {
        let bonus = 0;

        // Advanced piece coordination
        bonus += this.evaluatePieceCoordination(chessEngine, piece, row, col);

        // Piece activity and influence
        bonus += this.evaluatePieceActivity(chessEngine, piece, row, col);

        // Dynamic piece value based on position
        bonus += this.getDynamicPieceValue(chessEngine, piece, row, col);

        return bonus;
    }

    evaluatePieceCoordination(chessEngine, piece, row, col) {
        let coordination = 0;

        // Check for piece synergy
        const allies = this.getNearbyAllies(chessEngine, row, col, piece.color);

        switch (piece.type) {
            case 'rook':
                // Rooks on same rank/file
                for (let ally of allies) {
                    if (ally.piece.type === 'rook') {
                        if (ally.row === row || ally.col === col) {
                            coordination += 15;
                        }
                    }
                }
                break;

            case 'bishop':
                // Bishop battery
                for (let ally of allies) {
                    if (ally.piece.type === 'bishop' || ally.piece.type === 'queen') {
                        if (this.isOnSameDiagonal(row, col, ally.row, ally.col)) {
                            coordination += 12;
                        }
                    }
                }
                break;

            case 'knight':
                // Knight and bishop coordination
                for (let ally of allies) {
                    if (ally.piece.type === 'bishop') {
                        coordination += 8;
                    }
                }
                break;
        }

        return coordination;
    }

    evaluatePieceActivity(chessEngine, piece, row, col) {
        let activity = 0;

        // Control of key squares
        const moves = chessEngine.getPossibleMoves(row, col);
        for (let move of moves) {
            const [toRow, toCol] = move;

            // Central squares
            if (this.isCenterSquare(toRow, toCol)) {
                activity += 3;
            }

            // Extended center
            if (this.isExtendedCenter(toRow, toCol)) {
                activity += 2;
            }

            // Enemy territory
            if (this.isEnemyTerritory(toRow, piece.color)) {
                activity += 2;
            }
        }

        return Math.min(activity, 30); // Cap the bonus
    }

    getDynamicPieceValue(chessEngine, piece, row, col) {
        let dynamicValue = 0;

        // Piece becomes more valuable in endgame
        const materialCount = this.countMaterial(chessEngine);
        const endgameFactor = Math.max(0, (32 - materialCount) / 32);

        switch (piece.type) {
            case 'king':
                // King becomes active in endgame
                dynamicValue += endgameFactor * 50;
                break;

            case 'pawn':
                // Pawns become more valuable in endgame
                dynamicValue += endgameFactor * 20;

                // Advanced pawns
                const advancement = piece.color === 'white' ? (7 - row) : row;
                dynamicValue += advancement * advancement * 2;
                break;

            case 'knight':
                // Knights less effective in open endgames
                dynamicValue -= endgameFactor * 15;
                break;

            case 'bishop':
                // Bishops more effective in open positions
                dynamicValue += endgameFactor * 10;
                break;
        }

        return dynamicValue;
    }

    // Advanced strategic evaluation
    evaluateAdvancedStrategy(chessEngine) {
        let score = 0;

        score += this.evaluateSpaceAdvantage(chessEngine);
        score += this.evaluateWeakSquares(chessEngine);
        score += this.evaluatePieceTradeOffs(chessEngine);
        score += this.evaluateInitiative(chessEngine);

        return score;
    }

    evaluateSpaceAdvantage(chessEngine) {
        let whiteSpace = 0;
        let blackSpace = 0;

        // Count controlled squares in enemy half
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 8; col++) {
                if (chessEngine.isSquareAttacked(row, col, 'white')) {
                    whiteSpace++;
                }
                if (chessEngine.isSquareAttacked(7 - row, col, 'black')) {
                    blackSpace++;
                }
            }
        }

        return (whiteSpace - blackSpace) * 2;
    }

    evaluateWeakSquares(chessEngine) {
        let score = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (!chessEngine.board[row][col]) {
                    // Check if square is weak (can't be defended by pawns)
                    const whiteWeak = this.isWeakSquare(chessEngine, row, col, 'white');
                    const blackWeak = this.isWeakSquare(chessEngine, row, col, 'black');

                    if (whiteWeak && chessEngine.isSquareAttacked(row, col, 'black')) {
                        score -= 8;
                    }
                    if (blackWeak && chessEngine.isSquareAttacked(row, col, 'white')) {
                        score += 8;
                    }
                }
            }
        }

        return score;
    }

    evaluatePieceTradeOffs(chessEngine) {
        // Evaluate if current material imbalance is favorable
        let score = 0;

        const whiteMaterial = this.calculateMaterialValue(chessEngine, 'white');
        const blackMaterial = this.calculateMaterialValue(chessEngine, 'black');

        // Prefer trading when ahead in material
        if (whiteMaterial > blackMaterial) {
            score += (whiteMaterial - blackMaterial) * 0.1;
        } else {
            score -= (blackMaterial - whiteMaterial) * 0.1;
        }

        return score;
    }

    evaluateInitiative(chessEngine) {
        let score = 0;

        // Check for tempo advantages
        const whiteMoves = chessEngine.getAllValidMoves('white').length;
        const blackMoves = chessEngine.getAllValidMoves('black').length;

        // More moves = more initiative
        score += (whiteMoves - blackMoves) * 1.5;

        // Check for forcing moves (checks, captures, threats)
        score += this.countForcingMoves(chessEngine, 'white') * 3;
        score -= this.countForcingMoves(chessEngine, 'black') * 3;

        return score;
    }

    // Endgame knowledge
    evaluateEndgameKnowledge(chessEngine, materialCount) {
        if (materialCount > 16) return 0; // Not endgame yet

        let score = 0;

        // King and pawn endgames
        if (materialCount <= 8) {
            score += this.evaluateKingPawnEndgame(chessEngine);
        }

        // Rook endgames
        score += this.evaluateRookEndgame(chessEngine);

        // Bishop vs Knight endgames
        score += this.evaluateBishopKnightEndgame(chessEngine);

        return score;
    }

    evaluateKingPawnEndgame(chessEngine) {
        let score = 0;

        // King activity is crucial
        const whiteKing = this.findKing(chessEngine, 'white');
        const blackKing = this.findKing(chessEngine, 'black');

        if (whiteKing && blackKing) {
            // Centralized king bonus
            score += this.getKingCentralization(whiteKing) * 10;
            score -= this.getKingCentralization(blackKing) * 10;

            // Opposition evaluation
            if (this.hasOpposition(whiteKing, blackKing)) {
                score += chessEngine.currentPlayer === 'white' ? 20 : -20;
            }
        }

        return score;
    }

    evaluateRookEndgame(chessEngine) {
        let score = 0;

        // Rook activity
        const whiteRooks = this.findPieces(chessEngine, 'white', 'rook');
        const blackRooks = this.findPieces(chessEngine, 'black', 'rook');

        for (let rook of whiteRooks) {
            score += this.getRookActivity(chessEngine, rook.row, rook.col) * 5;
        }

        for (let rook of blackRooks) {
            score -= this.getRookActivity(chessEngine, rook.row, rook.col) * 5;
        }

        return score;
    }

    evaluateBishopKnightEndgame(chessEngine) {
        let score = 0;

        const whiteBishops = this.findPieces(chessEngine, 'white', 'bishop');
        const whiteKnights = this.findPieces(chessEngine, 'white', 'knight');
        const blackBishops = this.findPieces(chessEngine, 'black', 'bishop');
        const blackKnights = this.findPieces(chessEngine, 'black', 'knight');

        // Bishop pair advantage increases in endgame
        if (whiteBishops.length >= 2) score += 40;
        if (blackBishops.length >= 2) score -= 40;

        // Knights prefer closed positions, bishops prefer open
        const pawnCount = this.countPawns(chessEngine);
        const openness = (16 - pawnCount) / 16;

        score += (whiteBishops.length - whiteKnights.length) * openness * 15;
        score -= (blackBishops.length - blackKnights.length) * openness * 15;

        return score;
    }

    // Positional concepts
    evaluatePositionalConcepts(chessEngine) {
        let score = 0;

        score += this.evaluateColorComplexes(chessEngine);
        score += this.evaluateFileControl(chessEngine);
        score += this.evaluateDiagonalControl(chessEngine);
        score += this.evaluateSquareControl(chessEngine);

        return score;
    }

    evaluateColorComplexes(chessEngine) {
        let score = 0;

        // Light square and dark square control
        let whiteLightSquares = 0, whiteDarkSquares = 0;
        let blackLightSquares = 0, blackDarkSquares = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isLight = (row + col) % 2 === 0;

                if (chessEngine.isSquareAttacked(row, col, 'white')) {
                    if (isLight) whiteLightSquares++;
                    else whiteDarkSquares++;
                }

                if (chessEngine.isSquareAttacked(row, col, 'black')) {
                    if (isLight) blackLightSquares++;
                    else blackDarkSquares++;
                }
            }
        }

        // Bonus for controlling both color complexes
        const whiteBalance = Math.min(whiteLightSquares, whiteDarkSquares);
        const blackBalance = Math.min(blackLightSquares, blackDarkSquares);

        score += (whiteBalance - blackBalance) * 2;

        return score;
    }

    evaluateFileControl(chessEngine) {
        let score = 0;

        for (let file = 0; file < 8; file++) {
            let whiteControl = 0, blackControl = 0;

            for (let rank = 0; rank < 8; rank++) {
                if (chessEngine.isSquareAttacked(rank, file, 'white')) whiteControl++;
                if (chessEngine.isSquareAttacked(rank, file, 'black')) blackControl++;
            }

            if (whiteControl > blackControl) score += 3;
            else if (blackControl > whiteControl) score -= 3;
        }

        return score;
    }

    evaluateDiagonalControl(chessEngine) {
        let score = 0;

        // Major diagonals
        const diagonals = [
            [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]], // a1-h8
            [[0, 7], [1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1], [7, 0]]  // h1-a8
        ];

        for (let diagonal of diagonals) {
            let whiteControl = 0, blackControl = 0;

            for (let [row, col] of diagonal) {
                if (chessEngine.isSquareAttacked(row, col, 'white')) whiteControl++;
                if (chessEngine.isSquareAttacked(row, col, 'black')) blackControl++;
            }

            if (whiteControl > blackControl) score += 5;
            else if (blackControl > whiteControl) score -= 5;
        }

        return score;
    }

    evaluateSquareControl(chessEngine) {
        let score = 0;

        // Key squares (center and near-center)
        const keySquares = [
            [3, 3], [3, 4], [4, 3], [4, 4], // Center
            [2, 2], [2, 3], [2, 4], [2, 5], // Extended center
            [5, 2], [5, 3], [5, 4], [5, 5]
        ];

        for (let [row, col] of keySquares) {
            let whiteAttackers = 0, blackAttackers = 0;

            // Count attackers
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = chessEngine.board[r][c];
                    if (piece) {
                        const moves = chessEngine.getPossibleMoves(r, c);
                        if (moves.some(move => move[0] === row && move[1] === col)) {
                            if (piece.color === 'white') whiteAttackers++;
                            else blackAttackers++;
                        }
                    }
                }
            }

            score += (whiteAttackers - blackAttackers) * 2;
        }

        return score;
    }

    // Superhuman evaluation
    evaluateSuperhuman(chessEngine) {
        let score = 0;

        // Deep positional understanding
        score += this.evaluateDeepPositional(chessEngine);

        // Advanced tactical patterns
        score += this.evaluateAdvancedTactics(chessEngine);

        // Prophylactic thinking
        score += this.evaluateProphylaxis(chessEngine);

        return score;
    }

    evaluateDeepPositional(chessEngine) {
        let score = 0;

        // Evaluate long-term positional factors
        score += this.evaluateLongTermPlanning(chessEngine);
        score += this.evaluateStructuralWeaknesses(chessEngine);
        score += this.evaluateDynamicFactors(chessEngine);

        return score;
    }

    evaluateAdvancedTactics(chessEngine) {
        let score = 0;

        // Look for complex tactical motifs
        score += this.findDeflection(chessEngine);
        score += this.findDecoy(chessEngine);
        score += this.findInterference(chessEngine);
        score += this.findZwischenzug(chessEngine);

        return score;
    }

    evaluateProphylaxis(chessEngine) {
        let score = 0;

        // Evaluate opponent's threats and plans
        const opponentColor = chessEngine.currentPlayer === 'white' ? 'black' : 'white';
        const opponentThreats = this.findOpponentThreats(chessEngine, opponentColor);

        // Bonus for preventing opponent plans
        score += this.evaluatePreventiveMeasures(chessEngine, opponentThreats);

        return score;
    }

    // Helper methods for advanced evaluation
    getNearbyAllies(chessEngine, row, col, color) {
        const allies = [];
        for (let r = Math.max(0, row - 2); r <= Math.min(7, row + 2); r++) {
            for (let c = Math.max(0, col - 2); c <= Math.min(7, col + 2); c++) {
                if (r === row && c === col) continue;
                const piece = chessEngine.board[r][c];
                if (piece && piece.color === color) {
                    allies.push({ piece, row: r, col: c });
                }
            }
        }
        return allies;
    }

    isOnSameDiagonal(row1, col1, row2, col2) {
        return Math.abs(row1 - row2) === Math.abs(col1 - col2);
    }

    isExtendedCenter(row, col) {
        return row >= 2 && row <= 5 && col >= 2 && col <= 5;
    }

    isEnemyTerritory(row, color) {
        return color === 'white' ? row < 4 : row > 3;
    }

    countMaterial(chessEngine) {
        let count = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (chessEngine.board[row][col]) count++;
            }
        }
        return count;
    }

    isWeakSquare(chessEngine, row, col, color) {
        // A square is weak if it can't be defended by pawns
        const direction = color === 'white' ? 1 : -1;

        for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
            for (let r = row + direction; r >= 0 && r < 8; r += direction) {
                const piece = chessEngine.board[r][c];
                if (piece && piece.type === 'pawn' && piece.color === color) {
                    return false;
                }
            }
        }
        return true;
    }

    calculateMaterialValue(chessEngine, color) {
        let value = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.color === color) {
                    value += this.pieceValues[piece.type];
                }
            }
        }
        return value;
    }

    countForcingMoves(chessEngine, color) {
        const moves = chessEngine.getAllValidMoves(color);
        let forcingCount = 0;

        for (let move of moves) {
            // Check if move is forcing (capture, check, or threat)
            const target = chessEngine.board[move.to[0]][move.to[1]];
            if (target) forcingCount++; // Capture

            // Simulate move to check for check
            const cloned = chessEngine.clone();
            cloned.makeMove(move.from[0], move.from[1], move.to[0], move.to[1]);
            if (cloned.isInCheck(color === 'white' ? 'black' : 'white')) {
                forcingCount++; // Check
            }
        }

        return forcingCount;
    }

    findKing(chessEngine, color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    findPieces(chessEngine, color, type) {
        const pieces = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.color === color && piece.type === type) {
                    pieces.push({ row, col });
                }
            }
        }
        return pieces;
    }

    getKingCentralization(kingPos) {
        const centerDistance = Math.abs(kingPos.row - 3.5) + Math.abs(kingPos.col - 3.5);
        return 7 - centerDistance; // Higher score for more central king
    }

    hasOpposition(whiteKing, blackKing) {
        const rowDiff = Math.abs(whiteKing.row - blackKing.row);
        const colDiff = Math.abs(whiteKing.col - blackKing.col);
        return (rowDiff === 2 && colDiff === 0) || (rowDiff === 0 && colDiff === 2);
    }

    getRookActivity(chessEngine, row, col) {
        const moves = chessEngine.getPossibleMoves(row, col);
        return moves.length; // Simple activity measure
    }

    countPawns(chessEngine) {
        let count = 0;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.type === 'pawn') count++;
            }
        }
        return count;
    }

    // Placeholder methods for complex tactical patterns
    findDeflection(chessEngine) { return 0; }
    findDecoy(chessEngine) { return 0; }
    findInterference(chessEngine) { return 0; }
    findZwischenzug(chessEngine) { return 0; }

    evaluateLongTermPlanning(chessEngine) { return 0; }
    evaluateStructuralWeaknesses(chessEngine) { return 0; }
    evaluateDynamicFactors(chessEngine) { return 0; }

    findOpponentThreats(chessEngine, color) { return []; }
    evaluatePreventiveMeasures(chessEngine, threats) { return 0; }
}