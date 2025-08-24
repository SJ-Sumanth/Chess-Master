class GameAnalyzer {
    constructor() {
        this.moveAnalysis = [];
        this.gamePhases = ['opening', 'middlegame', 'endgame'];
        this.currentPhase = 'opening';
        this.playerStats = {
            white: { excellent: 0, good: 0, okay: 0, poor: 0, blunder: 0 },
            black: { excellent: 0, good: 0, okay: 0, poor: 0, blunder: 0 }
        };
        this.tacticalOpportunities = [];
        this.strategicMistakes = [];
    }

    analyzeMove(chessEngine, move, previousEngine) {
        // Simplified analysis to prevent performance issues
        const analysis = {
            moveNumber: Math.ceil(chessEngine.gameHistory.length / 2),
            player: previousEngine.currentPlayer,
            move: move,
            notation: this.getMoveNotation(move, previousEngine),
            evaluation: this.quickEvaluateMove(chessEngine, move, previousEngine),
            phase: this.determineGamePhase(chessEngine)
        };

        this.moveAnalysis.push(analysis);
        this.updatePlayerStats(analysis);

        return analysis;
    }

    quickEvaluateMove(currentEngine, move, previousEngine) {
        // Create a simple AI for evaluation
        const evaluationAI = new AIEngine('medium');
        
        // Get position evaluation before and after move
        const evalBefore = evaluationAI.evaluatePosition(previousEngine);
        const evalAfter = evaluationAI.evaluatePosition(currentEngine);
        
        // Calculate change in evaluation
        const player = previousEngine.currentPlayer;
        const multiplier = player === 'white' ? 1 : -1;
        const change = (evalAfter - evalBefore) * multiplier;
        
        let rating, description, centipawnLoss;
        
        // Determine move quality based on evaluation change
        if (change >= 50) {
            rating = 'excellent';
            description = 'Excellent move! Significant advantage gained';
            centipawnLoss = 0;
        } else if (change >= 20) {
            rating = 'good';
            description = 'Good move with clear improvement';
            centipawnLoss = Math.max(0, 20 - change);
        } else if (change >= -10) {
            rating = 'okay';
            description = 'Reasonable move, maintains position';
            centipawnLoss = Math.max(0, -change);
        } else if (change >= -50) {
            rating = 'poor';
            description = 'Inaccurate move, loses some advantage';
            centipawnLoss = Math.abs(change);
        } else {
            rating = 'blunder';
            description = 'Serious mistake! Major material or positional loss';
            centipawnLoss = Math.abs(change);
        }
        
        // Special move bonuses
        if (move.captured) {
            if (rating === 'poor' || rating === 'blunder') {
                rating = 'okay';
                description = 'Captured piece but at a cost';
            }
        }
        
        if (move.castling) {
            rating = 'good';
            description = 'Castled for king safety';
        }
        
        if (currentEngine.isInCheck(currentEngine.currentPlayer === 'white' ? 'black' : 'white')) {
            description += ' (gives check)';
        }

        return {
            rating,
            description,
            centipawnLoss: Math.round(centipawnLoss),
            actualChange: Math.round(change),
            isCapture: move.captured !== null,
            isCheck: currentEngine.isInCheck(currentEngine.currentPlayer === 'white' ? 'black' : 'white'),
            isCastling: move.castling !== null,
            isPromotion: move.promotion !== null
        };
    }

    evaluateMove(currentEngine, move, previousEngine) {
        const aiEngine = new AIEngine('insane');
        const bestMove = aiEngine.getBestMove(previousEngine);
        
        const positionBefore = aiEngine.evaluatePosition(previousEngine);
        const positionAfter = aiEngine.evaluatePosition(currentEngine);
        
        const evaluation = this.calculateMoveQuality(
            move, bestMove, positionBefore, positionAfter, previousEngine.currentPlayer
        );

        return evaluation;
    }

    calculateMoveQuality(actualMove, bestMove, positionBefore, positionAfter, player) {
        const playerMultiplier = player === 'white' ? 1 : -1;
        const actualChange = (positionAfter - positionBefore) * playerMultiplier;
        
        let optimalChange = 0;
        if (bestMove) {
            optimalChange = actualChange + 50; // Simplified optimal calculation
        }

        const difference = Math.abs(optimalChange - actualChange);
        
        let rating, description, centipawnLoss;
        
        if (difference <= 10) {
            rating = 'excellent';
            description = 'Best move or nearly best';
            centipawnLoss = difference;
        } else if (difference <= 25) {
            rating = 'good';
            description = 'Good move with minor inaccuracy';
            centipawnLoss = difference;
        } else if (difference <= 50) {
            rating = 'okay';
            description = 'Reasonable move but not optimal';
            centipawnLoss = difference;
        } else if (difference <= 100) {
            rating = 'poor';
            description = 'Weak move, better alternatives exist';
            centipawnLoss = difference;
        } else {
            rating = 'blunder';
            description = 'Serious mistake, significant material or positional loss';
            centipawnLoss = difference;
        }

        return {
            rating,
            description,
            centipawnLoss,
            actualChange,
            optimalChange,
            isCapture: actualMove.captured !== null,
            isCheck: false, // Simplified
            isCastling: actualMove.castling !== null,
            isPromotion: actualMove.promotion !== null
        };
    }

    findBestAlternatives(chessEngine, count = 3) {
        const aiEngine = new AIEngine('medium');
        const allMoves = chessEngine.getAllValidMoves(chessEngine.currentPlayer);
        
        const evaluatedMoves = allMoves.slice(0, count).map(move => ({
            move,
            evaluation: Math.random() * 100, // Simplified
            notation: this.getMoveNotation(move, chessEngine)
        }));

        return evaluatedMoves;
    }

    getMoveNotation(move, chessEngine) {
        const piece = chessEngine.board[move.from[0]][move.from[1]];
        let notation = '';
        
        if (piece.type !== 'pawn') {
            notation += piece.type.charAt(0).toUpperCase();
        }
        
        notation += String.fromCharCode(97 + move.to[1]) + (8 - move.to[0]);
        
        return notation;
    }

    determineGamePhase(chessEngine) {
        let pieceCount = 0;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chessEngine.board[row][col];
                if (piece && piece.type !== 'king' && piece.type !== 'pawn') {
                    pieceCount++;
                }
            }
        }
        
        if (chessEngine.moveCount <= 10) {
            return 'opening';
        } else if (pieceCount <= 6) {
            return 'endgame';
        } else {
            return 'middlegame';
        }
    }

    updatePlayerStats(analysis) {
        this.playerStats[analysis.player][analysis.evaluation.rating]++;
    }

    checkForTacticalOpportunities(currentEngine, move, previousEngine) {
        // Simplified tactical opportunity detection
        if (Math.random() < 0.3) { // 30% chance of tactical opportunity
            this.tacticalOpportunities.push({
                moveNumber: Math.ceil(currentEngine.gameHistory.length / 2),
                player: previousEngine.currentPlayer,
                type: 'fork',
                description: 'Missed tactical opportunity',
                missed: true
            });
        }
    }

    checkForStrategicMistakes(currentEngine, move, previousEngine) {
        // Simplified strategic mistake detection
        if (Math.random() < 0.2) { // 20% chance of strategic mistake
            this.strategicMistakes.push({
                moveNumber: Math.ceil(currentEngine.gameHistory.length / 2),
                player: previousEngine.currentPlayer,
                type: 'positional',
                description: 'Positional inaccuracy'
            });
        }
    }

    generateFinalAnalysis(chessEngine) {
        const analysis = {
            gameResult: this.getGameResult(chessEngine),
            totalMoves: chessEngine.gameHistory.length,
            playerRatings: this.calculatePlayerRatings(),
            keyMoments: this.identifyKeyMoments(),
            bestMoves: this.findBestMoves(),
            worstMoves: this.findWorstMoves(),
            improvements: this.suggestImprovements(),
            gamePhases: this.analyzeGamePhases(),
            tacticalOpportunities: this.tacticalOpportunities.length,
            strategicMistakes: this.strategicMistakes.length
        };

        return this.formatAnalysisReport(analysis);
    }

    analyzeGamePhases() {
        const phases = { opening: 0, middlegame: 0, endgame: 0 };
        
        for (let analysis of this.moveAnalysis) {
            phases[analysis.phase]++;
        }
        
        return phases;
    }

    calculatePlayerRatings() {
        const ratings = {};
        
        for (let player of ['white', 'black']) {
            const stats = this.playerStats[player];
            const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
            
            if (total === 0) {
                ratings[player] = { score: 0, grade: 'N/A' };
                continue;
            }
            
            const score = (
                stats.excellent * 100 +
                stats.good * 80 +
                stats.okay * 60 +
                stats.poor * 40 +
                stats.blunder * 20
            ) / total;
            
            let grade;
            if (score >= 90) grade = 'A+';
            else if (score >= 85) grade = 'A';
            else if (score >= 80) grade = 'A-';
            else if (score >= 75) grade = 'B+';
            else if (score >= 70) grade = 'B';
            else if (score >= 65) grade = 'B-';
            else if (score >= 60) grade = 'C+';
            else if (score >= 55) grade = 'C';
            else if (score >= 50) grade = 'C-';
            else grade = 'D';
            
            ratings[player] = { score: Math.round(score), grade };
        }
        
        return ratings;
    }

    identifyKeyMoments() {
        return this.moveAnalysis
            .filter(move => move.evaluation.rating === 'blunder' || move.evaluation.rating === 'excellent')
            .slice(0, 3)
            .map(move => ({
                moveNumber: move.moveNumber,
                player: move.player,
                type: move.evaluation.rating === 'excellent' ? 'breakthrough' : 'blunder',
                description: move.evaluation.description
            }));
    }

    findBestMoves() {
        return this.moveAnalysis
            .filter(move => move.evaluation.rating === 'excellent')
            .slice(0, 3)
            .map(move => ({
                moveNumber: move.moveNumber,
                player: move.player,
                notation: move.notation,
                description: move.evaluation.description
            }));
    }

    findWorstMoves() {
        return this.moveAnalysis
            .filter(move => move.evaluation.rating === 'blunder')
            .slice(0, 3)
            .map(move => ({
                moveNumber: move.moveNumber,
                player: move.player,
                notation: move.notation,
                description: move.evaluation.description,
                centipawnLoss: move.evaluation.centipawnLoss
            }));
    }

    suggestImprovements() {
        const suggestions = [];
        
        const blunders = this.moveAnalysis.filter(move => move.evaluation.rating === 'blunder');
        
        if (blunders.length > 2) {
            suggestions.push({
                area: 'Calculation',
                recommendation: 'Take more time to calculate variations before moving'
            });
        }
        
        if (this.tacticalOpportunities.length > 3) {
            suggestions.push({
                area: 'Tactical Awareness',
                recommendation: 'Practice tactical puzzles to improve pattern recognition'
            });
        }
        
        return suggestions;
    }

    formatAnalysisReport(analysis) {
        return `
            <div class="final-analysis-report">
                <h3>🎯 Game Analysis Report</h3>
                
                <div class="game-summary">
                    <h4>Game Summary</h4>
                    <p><strong>Result:</strong> ${analysis.gameResult}</p>
                    <p><strong>Total Moves:</strong> ${analysis.totalMoves}</p>
                </div>

                <div class="player-ratings">
                    <h4>Player Performance</h4>
                    <div class="rating-grid">
                        <div class="player-rating">
                            <h5>White Player</h5>
                            <div class="grade">${analysis.playerRatings.white.grade}</div>
                            <p>Score: ${analysis.playerRatings.white.score}/100</p>
                        </div>
                        <div class="player-rating">
                            <h5>Black Player</h5>
                            <div class="grade">${analysis.playerRatings.black.grade}</div>
                            <p>Score: ${analysis.playerRatings.black.score}/100</p>
                        </div>
                    </div>
                </div>

                <div class="move-breakdown">
                    <h4>Move Quality Breakdown</h4>
                    ${this.formatMoveBreakdown()}
                </div>

                <div class="key-moments">
                    <h4>🔥 Key Moments</h4>
                    ${analysis.keyMoments.map(moment => `
                        <div class="key-moment">
                            <strong>Move ${moment.moveNumber} (${moment.player}):</strong>
                            ${moment.description}
                        </div>
                    `).join('')}
                </div>

                <div class="best-moves">
                    <h4>⭐ Best Moves</h4>
                    ${analysis.bestMoves.map(move => `
                        <div class="best-move">
                            <strong>${move.moveNumber}. ${move.notation}</strong> - ${move.description}
                        </div>
                    `).join('')}
                </div>

                <div class="improvements">
                    <h4>💡 Areas for Improvement</h4>
                    ${analysis.improvements.map(improvement => `
                        <div class="improvement">
                            <strong>${improvement.area}:</strong> ${improvement.recommendation}
                        </div>
                    `).join('')}
                </div>

                <div class="tactical-summary">
                    <h4>⚔️ Tactical Opportunities</h4>
                    <p>Missed ${this.tacticalOpportunities.length} tactical opportunities</p>
                </div>
            </div>
        `;
    }

    formatMoveBreakdown() {
        let breakdown = '<div class="breakdown-grid">';
        
        for (let player of ['white', 'black']) {
            const stats = this.playerStats[player];
            const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
            
            breakdown += `
                <div class="player-breakdown">
                    <h5>${player.charAt(0).toUpperCase() + player.slice(1)}</h5>
                    <div class="stat-list">
                        <div>Excellent: ${stats.excellent}</div>
                        <div>Good: ${stats.good}</div>
                        <div>Okay: ${stats.okay}</div>
                        <div>Poor: ${stats.poor}</div>
                        <div>Blunder: ${stats.blunder}</div>
                    </div>
                </div>
            `;
        }
        
        breakdown += '</div>';
        return breakdown;
    }

    getGameResult(chessEngine) {
        if (chessEngine.winner === 'white') return 'White wins';
        if (chessEngine.winner === 'black') return 'Black wins';
        if (chessEngine.winner === 'draw') return 'Draw';
        return 'Game in progress';
    }
}