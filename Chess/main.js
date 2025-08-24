// Global game state
let chessEngine = null;
let aiEngine = null;
let gameAnalyzer = null;
let gameMode = null;
let difficulty = null;
let selectedSquare = null;
let validMoves = [];
let isPlayerTurn = true;
let analysisEnabled = false;
let isAnimating = false;
let isPaused = false;

// Undo/Redo system
let gameStateHistory = [];
let currentStateIndex = -1;
let maxHistorySize = 50;

// Performance optimization
const ANIMATION_DURATION = 300;
const AI_THINK_TIME = 100;

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    showGameModes();
});

function selectMode(mode) {
    gameMode = mode;
    
    if (mode === 'two-player') {
        startGame();
    } else if (mode === 'single-player') {
        showDifficultySelection();
    }
}

function showGameModes() {
    document.getElementById('gameModes').style.display = 'flex';
    document.getElementById('difficultySelection').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('gameOverModal').style.display = 'none';
}

function showDifficultySelection() {
    document.getElementById('gameModes').style.display = 'none';
    document.getElementById('difficultySelection').style.display = 'block';
    document.getElementById('gameContainer').style.display = 'none';
}

function startGame(selectedDifficulty = null) {
    difficulty = selectedDifficulty;
    
    // Initialize game components
    chessEngine = new ChessEngine();
    gameAnalyzer = new GameAnalyzer();
    
    if (gameMode === 'single-player') {
        aiEngine = new AIEngine(difficulty);
    }
    
    // Reset game state
    gameStateHistory = [];
    currentStateIndex = -1;
    isPaused = false;
    
    // Save initial state
    saveGameState();
    
    // Show game interface
    document.getElementById('gameModes').style.display = 'none';
    document.getElementById('difficultySelection').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    document.getElementById('pauseOverlay').style.display = 'none';
    
    // Update player names based on game mode
    updatePlayerNames();
    
    // Initialize board
    createBoard();
    updateGameInfo();
    updateAnalysis();
    updateControlButtons();
    
    isPlayerTurn = true;
}

// Realistic chess piece symbols with better styling
const PIECE_SYMBOLS = {
    white: {
        king: '♔', queen: '♕', rook: '♖',
        bishop: '♗', knight: '♘', pawn: '♙'
    },
    black: {
        king: '♚', queen: '♛', rook: '♜',
        bishop: '♝', knight: '♞', pawn: '♟'
    }
};

function createPieceElement(piece) {
    const pieceElement = document.createElement('div');
    pieceElement.className = `piece ${piece.color}-piece ${piece.type}`;
    pieceElement.textContent = PIECE_SYMBOLS[piece.color][piece.type];
    return pieceElement;
}

function createBoard() {
    const boardElement = document.getElementById('chessboard');
    boardElement.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            
            const piece = chessEngine.board[row][col];
            if (piece) {
                const pieceElement = createPieceElement(piece);
                square.appendChild(pieceElement);
            }
            
            square.addEventListener('click', handleSquareClick);
            boardElement.appendChild(square);
        }
    }
}

function handleSquareClick(event) {
    if (!isPlayerTurn && gameMode === 'single-player') return;
    if (chessEngine.isGameOver || isAnimating || isPaused) return;
    
    // Get the square element (handle clicks on both square and piece)
    let squareElement = event.target;
    if (squareElement.classList.contains('piece')) {
        squareElement = squareElement.parentElement;
    }
    
    const row = parseInt(squareElement.dataset.row);
    const col = parseInt(squareElement.dataset.col);
    
    if (isNaN(row) || isNaN(col)) return;
    
    if (selectedSquare) {
        // Try to make a move
        if (isValidMove(row, col)) {
            makePlayerMoveWithAnimation(selectedSquare.row, selectedSquare.col, row, col);
        }
        clearSelection();
    } else {
        // Select a piece
        const piece = chessEngine.board[row][col];
        if (piece && piece.color === chessEngine.currentPlayer) {
            selectSquare(row, col);
        }
    }
}

function selectSquare(row, col) {
    selectedSquare = { row, col };
    validMoves = chessEngine.getPossibleMoves(row, col);
    
    updateBoardDisplay();
}

function clearSelection() {
    selectedSquare = null;
    validMoves = [];
    updateBoardDisplay();
}

function isValidMove(row, col) {
    return validMoves.some(move => move[0] === row && move[1] === col);
}

function makePlayerMoveWithAnimation(fromRow, fromCol, toRow, toCol) {
    const previousEngine = chessEngine.clone();
    const move = chessEngine.makeMove(fromRow, fromCol, toRow, toCol);
    
    // Save game state for undo/redo
    saveGameState();
    
    // Only analyze if analysis is enabled and appropriate for game mode
    if (analysisEnabled && shouldShowAnalysis()) {
        requestIdleCallback(() => {
            const analysis = gameAnalyzer.analyzeMove(chessEngine, move, previousEngine);
            updateAnalysis(analysis);
        });
    }
    
    updateGameDisplay();
    updateMoveHistory();
    updateControlButtons();
    
    // Check for game over
    if (chessEngine.isGameOver) {
        endGame();
        return;
    }
    
    // AI move in single player mode
    if (gameMode === 'single-player') {
        isPlayerTurn = false;
        // Small delay to show the move was made, then AI thinks
        setTimeout(() => {
            makeAIMove();
        }, 100);
    }
}

function animatePieceMove(fromRow, fromCol, toRow, toCol, callback) {
    const squares = document.querySelectorAll('.square');
    const fromSquare = Array.from(squares).find(sq => 
        parseInt(sq.dataset.row) === fromRow && parseInt(sq.dataset.col) === fromCol
    );
    
    if (fromSquare) {
        const piece = fromSquare.querySelector('.piece');
        if (piece) {
            piece.classList.add('moving');
            setTimeout(() => {
                piece.classList.remove('moving');
                piece.classList.add('just-moved');
                setTimeout(() => {
                    piece.classList.remove('just-moved');
                }, ANIMATION_DURATION);
                if (callback) callback();
            }, ANIMATION_DURATION);
        }
    } else if (callback) {
        callback();
    }
}

async function makeAIMove() {
    if (chessEngine.isGameOver || isPaused) return;
    
    // Show thinking indicator
    updateGameInfo();
    
    try {
        const previousEngine = chessEngine.clone();
        
        // Use async AI calculation to prevent blocking
        const bestMove = await aiEngine.getBestMove(chessEngine);
        
        if (bestMove && !chessEngine.isGameOver && !isPaused) {
            const move = chessEngine.makeMove(
                bestMove.from[0], bestMove.from[1], 
                bestMove.to[0], bestMove.to[1]
            );
            
            // Save game state for undo/redo
            saveGameState();
            
            // Skip analysis for AI moves to improve performance
            if (analysisEnabled && shouldShowAnalysis()) {
                requestIdleCallback(() => {
                    const analysis = gameAnalyzer.analyzeMove(chessEngine, move, previousEngine);
                    updateAnalysis(analysis);
                });
            }
            
            updateGameDisplay();
            updateMoveHistory();
            updateControlButtons();
            
            // Check for game over
            if (chessEngine.isGameOver) {
                endGame();
                return;
            }
        }
    } catch (error) {
        console.warn('AI move calculation error:', error);
    } finally {
        isPlayerTurn = true;
        updateGameInfo(); // Update to remove thinking indicator
    }
}

function updateGameDisplay() {
    createBoard();
    updateGameInfo();
    updateCapturedPieces();
    updateBoardDisplay();
}

function animateMove(fromRow, fromCol, toRow, toCol, callback) {
    const squares = document.querySelectorAll('.square');
    const fromSquare = Array.from(squares).find(sq => 
        parseInt(sq.dataset.row) === fromRow && parseInt(sq.dataset.col) === fromCol
    );
    const toSquare = Array.from(squares).find(sq => 
        parseInt(sq.dataset.row) === toRow && parseInt(sq.dataset.col) === toCol
    );
    
    if (fromSquare && toSquare) {
        const piece = fromSquare.querySelector('.piece');
        if (piece) {
            piece.classList.add('moving');
            setTimeout(() => {
                piece.classList.remove('moving');
                piece.classList.add('just-moved');
                setTimeout(() => {
                    piece.classList.remove('just-moved');
                }, 300);
                if (callback) callback();
            }, 200);
        }
    } else if (callback) {
        callback();
    }
}

function updateBoardDisplay() {
    const squares = document.querySelectorAll('.square');
    
    squares.forEach(square => {
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        
        // Clear previous highlights
        square.classList.remove('selected', 'valid-move', 'capture-move', 'last-move', 'in-check');
        
        // Highlight selected square
        if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
            square.classList.add('selected');
        }
        
        // Highlight valid moves
        if (validMoves.some(move => move[0] === row && move[1] === col)) {
            if (chessEngine.board[row][col]) {
                square.classList.add('capture-move');
            } else {
                square.classList.add('valid-move');
            }
        }
        
        // Highlight last move
        if (chessEngine.lastMove) {
            if ((chessEngine.lastMove.from[0] === row && chessEngine.lastMove.from[1] === col) ||
                (chessEngine.lastMove.to[0] === row && chessEngine.lastMove.to[1] === col)) {
                square.classList.add('last-move');
            }
        }
        
        // Highlight king in check
        const piece = chessEngine.board[row][col];
        if (piece && piece.type === 'king' && chessEngine.isInCheck(piece.color)) {
            square.classList.add('in-check');
        }
    });
}

function updateGameInfo() {
    const currentTurnElement = document.getElementById('currentTurn');
    const moveCounterElement = document.getElementById('moveCounter');
    
    if (chessEngine.isGameOver) {
        if (chessEngine.winner === 'draw') {
            currentTurnElement.innerHTML = '<i class="fas fa-handshake"></i> Game Draw';
        } else {
            const winner = chessEngine.winner.charAt(0).toUpperCase() + chessEngine.winner.slice(1);
            currentTurnElement.innerHTML = `<i class="fas fa-crown"></i> ${winner} wins!`;
        }
    } else {
        const currentPlayer = chessEngine.currentPlayer === 'white' ? 'White' : 'Black';
        
        if (!isPlayerTurn && gameMode === 'single-player') {
            const aiPlayer = gameMode === 'single-player' && chessEngine.currentPlayer === 'black' ? 'AI' : currentPlayer;
            currentTurnElement.innerHTML = `<i class="fas fa-brain"></i> ${aiPlayer} thinking... <span class="loading"></span>`;
        } else {
            currentTurnElement.innerHTML = `<i class="fas fa-chess"></i> ${currentPlayer} to move`;
        }
        
        if (chessEngine.isInCheck(chessEngine.currentPlayer)) {
            currentTurnElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${currentPlayer} in check!`;
            currentTurnElement.style.color = '#ff4444';
        } else {
            currentTurnElement.style.color = '';
        }
    }
    
    if (moveCounterElement) {
        moveCounterElement.textContent = chessEngine.moveCount;
    }
}

function updateCapturedPieces() {
    const whiteCapturedElement = document.getElementById('whiteCaptured');
    const blackCapturedElement = document.getElementById('blackCaptured');
    
    whiteCapturedElement.innerHTML = '';
    blackCapturedElement.innerHTML = '';
    
    chessEngine.capturedPieces.white.forEach(piece => {
        const pieceElement = document.createElement('span');
        pieceElement.className = `captured-piece ${piece.color}-piece ${piece.type}`;
        pieceElement.textContent = PIECE_SYMBOLS[piece.color][piece.type];
        whiteCapturedElement.appendChild(pieceElement);
    });
    
    chessEngine.capturedPieces.black.forEach(piece => {
        const pieceElement = document.createElement('span');
        pieceElement.className = `captured-piece ${piece.color}-piece ${piece.type}`;
        pieceElement.textContent = PIECE_SYMBOLS[piece.color][piece.type];
        blackCapturedElement.appendChild(pieceElement);
    });
}

function updateMoveHistory() {
    const movesList = document.getElementById('movesList');
    const history = chessEngine.gameHistory;
    
    let historyHtml = '';
    for (let i = 0; i < history.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = history[i];
        const blackMove = history[i + 1];
        
        historyHtml += `<div class="move-pair">`;
        historyHtml += `<span class="move-number">${moveNumber}.</span>`;
        historyHtml += `<span class="white-move">${getMoveNotation(whiteMove)}</span>`;
        if (blackMove) {
            historyHtml += `<span class="black-move">${getMoveNotation(blackMove)}</span>`;
        }
        historyHtml += `</div>`;
    }
    
    movesList.innerHTML = historyHtml;
    movesList.scrollTop = movesList.scrollHeight;
}

function getMoveNotation(move) {
    if (!move) return '';
    
    const piece = move.piece;
    const fromFile = String.fromCharCode(97 + move.from[1]);
    const fromRank = 8 - move.from[0];
    const toFile = String.fromCharCode(97 + move.to[1]);
    const toRank = 8 - move.to[0];
    
    let notation = '';
    
    // Castling
    if (move.castling) {
        return move.castling === 'kingside' ? 'O-O' : 'O-O-O';
    }
    
    // Piece notation (except pawns)
    if (piece.type !== 'pawn') {
        notation += piece.type.charAt(0).toUpperCase();
    }
    
    // Capture notation
    if (move.captured || move.enPassant) {
        if (piece.type === 'pawn') {
            notation += fromFile;
        }
        notation += 'x';
    }
    
    // Destination
    notation += toFile + toRank;
    
    // Promotion
    if (move.promotion) {
        notation += '=' + move.promotion.charAt(0).toUpperCase();
    }
    
    return notation;
}

function updateAnalysis(moveAnalysis = null) {
    if (!analysisEnabled) return;
    
    const analysisContent = document.getElementById('analysisContent');
    
    if (moveAnalysis) {
        const ratingColor = {
            'excellent': '#27ae60',
            'good': '#2ecc71', 
            'okay': '#f39c12',
            'poor': '#e67e22',
            'blunder': '#e74c3c'
        };
        
        const analysisHtml = `
            <div class="move-analysis" style="border-left: 4px solid ${ratingColor[moveAnalysis.evaluation.rating]};">
                <div class="move-header">
                    <h4>Move ${moveAnalysis.moveNumber}: ${moveAnalysis.notation}</h4>
                    <span class="move-rating rating-${moveAnalysis.evaluation.rating}" 
                          style="background: ${ratingColor[moveAnalysis.evaluation.rating]};">
                        ${moveAnalysis.evaluation.rating.toUpperCase()}
                    </span>
                </div>
                <p><strong>Player:</strong> ${moveAnalysis.player.charAt(0).toUpperCase() + moveAnalysis.player.slice(1)}</p>
                <p><strong>Evaluation:</strong> ${moveAnalysis.evaluation.description}</p>
                ${moveAnalysis.evaluation.centipawnLoss > 0 ? 
                    `<p><strong>Accuracy Loss:</strong> ${moveAnalysis.evaluation.centipawnLoss} centipawns</p>` : ''}
                ${moveAnalysis.evaluation.actualChange ? 
                    `<p><strong>Position Change:</strong> ${moveAnalysis.evaluation.actualChange > 0 ? '+' : ''}${moveAnalysis.evaluation.actualChange}</p>` : ''}
                <p><strong>Game Phase:</strong> ${moveAnalysis.phase.charAt(0).toUpperCase() + moveAnalysis.phase.slice(1)}</p>
                <div class="move-flags">
                    ${moveAnalysis.evaluation.isCapture ? '<span class="flag capture">Capture</span>' : ''}
                    ${moveAnalysis.evaluation.isCheck ? '<span class="flag check">Check</span>' : ''}
                    ${moveAnalysis.evaluation.isCastling ? '<span class="flag castling">Castling</span>' : ''}
                    ${moveAnalysis.evaluation.isPromotion ? '<span class="flag promotion">Promotion</span>' : ''}
                </div>
            </div>
        `;
        
        analysisContent.innerHTML = analysisHtml + analysisContent.innerHTML;
        
        // Limit to last 10 analyses to prevent overflow
        const analyses = analysisContent.querySelectorAll('.move-analysis');
        if (analyses.length > 10) {
            for (let i = 10; i < analyses.length; i++) {
                analyses[i].remove();
            }
        }
    } else {
        analysisContent.innerHTML = `
            <div class="analysis-placeholder">
                <i class="fas fa-chess-board"></i>
                <p>Make a move to see detailed analysis...</p>
                <p class="analysis-tip">The AI will evaluate each move and provide insights on accuracy, tactics, and strategy.</p>
            </div>
        `;
    }
}

function toggleAnalysis() {
    analysisEnabled = !analysisEnabled;
    const analysisPanel = document.getElementById('analysisPanel');
    
    if (analysisEnabled) {
        analysisPanel.classList.add('active');
        updateAnalysis();
    } else {
        analysisPanel.classList.remove('active');
    }
}

function endGame() {
    const modal = document.getElementById('gameOverModal');
    const gameResult = document.getElementById('gameResult');
    const finalAnalysis = document.getElementById('finalAnalysis');
    
    // Set game result
    if (chessEngine.winner === 'draw') {
        gameResult.textContent = 'Game Draw!';
    } else {
        const winner = chessEngine.winner.charAt(0).toUpperCase() + chessEngine.winner.slice(1);
        gameResult.textContent = `${winner} Wins!`;
    }
    
    // Generate final analysis
    const analysisReport = gameAnalyzer.generateFinalAnalysis(chessEngine);
    finalAnalysis.innerHTML = analysisReport;
    
    // Show modal
    modal.style.display = 'flex';
}

function newGame() {
    document.getElementById('gameOverModal').style.display = 'none';
    
    if (gameMode && (gameMode === 'two-player' || difficulty)) {
        startGame(difficulty);
    } else {
        showGameModes();
    }
}

function backToModes() {
    document.getElementById('gameOverModal').style.display = 'none';
    showGameModes();
    
    // Reset game state
    chessEngine = null;
    aiEngine = null;
    gameAnalyzer = null;
    gameMode = null;
    difficulty = null;
    selectedSquare = null;
    validMoves = [];
    isPlayerTurn = true;
    analysisEnabled = false;
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    switch(event.key) {
        case 'Escape':
            clearSelection();
            if (isPaused) {
                resumeGame();
            }
            break;
        case 'n':
        case 'N':
            if (event.ctrlKey) {
                event.preventDefault();
                newGame();
            }
            break;
        case 'a':
        case 'A':
            if (event.ctrlKey) {
                event.preventDefault();
                toggleAnalysis();
            }
            break;
        case 'z':
        case 'Z':
            if (event.ctrlKey && !event.shiftKey) {
                event.preventDefault();
                undoMove();
            }
            break;
        case 'y':
        case 'Y':
            if (event.ctrlKey) {
                event.preventDefault();
                redoMove();
            }
            break;
        case 'Z':
            if (event.ctrlKey && event.shiftKey) {
                event.preventDefault();
                redoMove();
            }
            break;
        case ' ':
            event.preventDefault();
            if (isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
            break;
        case 'r':
        case 'R':
            if (event.ctrlKey) {
                event.preventDefault();
                restartGame();
            }
            break;
    }
});

// New game features

// Undo/Redo functionality
function saveGameState() {
    // Remove any states after current index (for redo functionality)
    gameStateHistory = gameStateHistory.slice(0, currentStateIndex + 1);
    
    // Add current state
    gameStateHistory.push({
        engine: chessEngine.clone(),
        analyzer: cloneAnalyzer(),
        isPlayerTurn: isPlayerTurn
    });
    
    currentStateIndex++;
    
    // Limit history size
    if (gameStateHistory.length > maxHistorySize) {
        gameStateHistory.shift();
        currentStateIndex--;
    }
}

function cloneAnalyzer() {
    return {
        moveAnalysis: [...gameAnalyzer.moveAnalysis],
        playerStats: {
            white: {...gameAnalyzer.playerStats.white},
            black: {...gameAnalyzer.playerStats.black}
        },
        tacticalOpportunities: [...gameAnalyzer.tacticalOpportunities],
        strategicMistakes: [...gameAnalyzer.strategicMistakes]
    };
}

function undoMove() {
    if (currentStateIndex <= 0 || isPaused) return;
    
    currentStateIndex--;
    const state = gameStateHistory[currentStateIndex];
    
    chessEngine = state.engine.clone();
    gameAnalyzer.moveAnalysis = [...state.analyzer.moveAnalysis];
    gameAnalyzer.playerStats = {
        white: {...state.analyzer.playerStats.white},
        black: {...state.analyzer.playerStats.black}
    };
    gameAnalyzer.tacticalOpportunities = [...state.analyzer.tacticalOpportunities];
    gameAnalyzer.strategicMistakes = [...state.analyzer.strategicMistakes];
    isPlayerTurn = state.isPlayerTurn;
    
    updateGameDisplay();
    updateMoveHistory();
    updateControlButtons();
    
    if (analysisEnabled && shouldShowAnalysis()) {
        updateAnalysis();
    }
}

function redoMove() {
    if (currentStateIndex >= gameStateHistory.length - 1 || isPaused) return;
    
    currentStateIndex++;
    const state = gameStateHistory[currentStateIndex];
    
    chessEngine = state.engine.clone();
    gameAnalyzer.moveAnalysis = [...state.analyzer.moveAnalysis];
    gameAnalyzer.playerStats = {
        white: {...state.analyzer.playerStats.white},
        black: {...state.analyzer.playerStats.black}
    };
    gameAnalyzer.tacticalOpportunities = [...state.analyzer.tacticalOpportunities];
    gameAnalyzer.strategicMistakes = [...state.analyzer.strategicMistakes];
    isPlayerTurn = state.isPlayerTurn;
    
    updateGameDisplay();
    updateMoveHistory();
    updateControlButtons();
    
    if (analysisEnabled && shouldShowAnalysis()) {
        updateAnalysis();
    }
}

// Pause/Resume functionality
function pauseGame() {
    if (chessEngine.isGameOver) return;
    
    isPaused = true;
    document.getElementById('pauseOverlay').style.display = 'flex';
    
    // Update pause button
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
    pauseBtn.onclick = resumeGame;
}

function resumeGame() {
    isPaused = false;
    document.getElementById('pauseOverlay').style.display = 'none';
    
    // Update pause button
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
    pauseBtn.onclick = pauseGame;
}

// Restart functionality
function restartGame() {
    if (confirm('Are you sure you want to restart the game? All progress will be lost.')) {
        startGame(difficulty);
    }
}

// Update control buttons state
function updateControlButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    
    // Undo button
    undoBtn.disabled = currentStateIndex <= 0 || chessEngine.isGameOver;
    undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
    
    // Redo button
    redoBtn.disabled = currentStateIndex >= gameStateHistory.length - 1 || chessEngine.isGameOver;
    redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    
    // Pause button
    pauseBtn.disabled = chessEngine.isGameOver;
    pauseBtn.style.opacity = pauseBtn.disabled ? '0.5' : '1';
}

// Update player names based on game mode
function updatePlayerNames() {
    const whitePlayerName = document.getElementById('whitePlayerName');
    const blackPlayerName = document.getElementById('blackPlayerName');
    
    if (gameMode === 'single-player') {
        whitePlayerName.textContent = 'You (White)';
        blackPlayerName.textContent = `AI (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`;
    } else {
        whitePlayerName.textContent = 'White Player';
        blackPlayerName.textContent = 'Black Player';
    }
}

// Determine if analysis should be shown based on game mode
function shouldShowAnalysis() {
    if (gameMode === 'single-player') {
        // In single player, only show analysis for user moves
        return true;
    } else {
        // In two player mode, show analysis for both players
        return true;
    }
}

// Update the analysis display based on game mode
function updateAnalysis(moveAnalysis = null) {
    if (!analysisEnabled) return;
    
    const analysisContent = document.getElementById('analysisContent');
    
    if (moveAnalysis) {
        // Filter analysis based on game mode
        if (gameMode === 'single-player' && moveAnalysis.player === 'black') {
            // Don't show AI move analysis in single player mode
            return;
        }
        
        const ratingColor = {
            'excellent': '#27ae60',
            'good': '#2ecc71', 
            'okay': '#f39c12',
            'poor': '#e67e22',
            'blunder': '#e74c3c'
        };
        
        const playerDisplayName = gameMode === 'single-player' && moveAnalysis.player === 'white' 
            ? 'Your Move' 
            : moveAnalysis.player.charAt(0).toUpperCase() + moveAnalysis.player.slice(1);
        
        const analysisHtml = `
            <div class="move-analysis" style="border-left: 4px solid ${ratingColor[moveAnalysis.evaluation.rating]};">
                <div class="move-header">
                    <h4>Move ${moveAnalysis.moveNumber}: ${moveAnalysis.notation}</h4>
                    <span class="move-rating rating-${moveAnalysis.evaluation.rating}" 
                          style="background: ${ratingColor[moveAnalysis.evaluation.rating]};">
                        ${moveAnalysis.evaluation.rating.toUpperCase()}
                    </span>
                </div>
                <p><strong>Player:</strong> ${playerDisplayName}</p>
                <p><strong>Evaluation:</strong> ${moveAnalysis.evaluation.description}</p>
                ${moveAnalysis.evaluation.centipawnLoss > 0 ? 
                    `<p><strong>Accuracy Loss:</strong> ${moveAnalysis.evaluation.centipawnLoss} centipawns</p>` : ''}
                ${moveAnalysis.evaluation.actualChange ? 
                    `<p><strong>Position Change:</strong> ${moveAnalysis.evaluation.actualChange > 0 ? '+' : ''}${moveAnalysis.evaluation.actualChange}</p>` : ''}
                <p><strong>Game Phase:</strong> ${moveAnalysis.phase.charAt(0).toUpperCase() + moveAnalysis.phase.slice(1)}</p>
                <div class="move-flags">
                    ${moveAnalysis.evaluation.isCapture ? '<span class="flag capture">Capture</span>' : ''}
                    ${moveAnalysis.evaluation.isCheck ? '<span class="flag check">Check</span>' : ''}
                    ${moveAnalysis.evaluation.isCastling ? '<span class="flag castling">Castling</span>' : ''}
                    ${moveAnalysis.evaluation.isPromotion ? '<span class="flag promotion">Promotion</span>' : ''}
                </div>
            </div>
        `;
        
        analysisContent.innerHTML = analysisHtml + analysisContent.innerHTML;
        
        // Limit to last 10 analyses to prevent overflow
        const analyses = analysisContent.querySelectorAll('.move-analysis');
        if (analyses.length > 10) {
            for (let i = 10; i < analyses.length; i++) {
                analyses[i].remove();
            }
        }
    } else {
        analysisContent.innerHTML = `
            <div class="analysis-placeholder">
                <i class="fas fa-chess-board"></i>
                <p>Make a move to see detailed analysis...</p>
                <p class="analysis-tip">The AI will evaluate each move and provide insights on accuracy, tactics, and strategy.</p>
            </div>
        `;
    }
}

// Update the final analysis to show appropriate player stats
function endGame() {
    const modal = document.getElementById('gameOverModal');
    const gameResult = document.getElementById('gameResult');
    const finalAnalysis = document.getElementById('finalAnalysis');
    
    // Set game result
    if (chessEngine.winner === 'draw') {
        gameResult.textContent = 'Game Draw!';
    } else {
        const winner = chessEngine.winner.charAt(0).toUpperCase() + chessEngine.winner.slice(1);
        gameResult.textContent = `${winner} Wins!`;
    }
    
    // Generate final analysis based on game mode
    const analysisReport = generateCustomFinalAnalysis();
    finalAnalysis.innerHTML = analysisReport;
    
    // Show modal
    modal.style.display = 'flex';
}

function generateCustomFinalAnalysis() {
    if (gameMode === 'single-player') {
        // Show only user analysis in single player mode
        return generateSinglePlayerAnalysis();
    } else {
        // Show both players analysis in two player mode
        return gameAnalyzer.generateFinalAnalysis(chessEngine);
    }
}

function generateSinglePlayerAnalysis() {
    const userStats = gameAnalyzer.playerStats.white;
    const total = Object.values(userStats).reduce((sum, count) => sum + count, 0);
    
    let userScore = 0;
    let userGrade = 'N/A';
    
    if (total > 0) {
        userScore = (
            userStats.excellent * 100 +
            userStats.good * 80 +
            userStats.okay * 60 +
            userStats.poor * 40 +
            userStats.blunder * 20
        ) / total;
        
        if (userScore >= 90) userGrade = 'A+';
        else if (userScore >= 85) userGrade = 'A';
        else if (userScore >= 80) userGrade = 'A-';
        else if (userScore >= 75) userGrade = 'B+';
        else if (userScore >= 70) userGrade = 'B';
        else if (userScore >= 65) userGrade = 'B-';
        else if (userScore >= 60) userGrade = 'C+';
        else if (userScore >= 55) userGrade = 'C';
        else if (userScore >= 50) userGrade = 'C-';
        else userGrade = 'D';
    }
    
    const userMoves = gameAnalyzer.moveAnalysis.filter(move => move.player === 'white');
    const bestMoves = userMoves.filter(move => move.evaluation.rating === 'excellent').slice(0, 3);
    const blunders = userMoves.filter(move => move.evaluation.rating === 'blunder').slice(0, 3);
    
    return `
        <div class="final-analysis-report">
            <h3>🎯 Your Performance Analysis</h3>
            
            <div class="game-summary">
                <h4>Game Summary</h4>
                <p><strong>Result:</strong> ${gameAnalyzer.getGameResult(chessEngine)}</p>
                <p><strong>Total Moves:</strong> ${chessEngine.gameHistory.length}</p>
                <p><strong>Difficulty:</strong> ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</p>
            </div>

            <div class="player-ratings">
                <h4>Your Performance</h4>
                <div class="player-rating" style="margin: 0 auto; max-width: 300px;">
                    <h5>Your Score</h5>
                    <div class="grade">${userGrade}</div>
                    <p>Score: ${Math.round(userScore)}/100</p>
                </div>
            </div>

            <div class="move-breakdown">
                <h4>Your Move Quality</h4>
                <div class="player-breakdown" style="margin: 0 auto; max-width: 300px;">
                    <div class="stat-list">
                        <div>Excellent: ${userStats.excellent}</div>
                        <div>Good: ${userStats.good}</div>
                        <div>Okay: ${userStats.okay}</div>
                        <div>Poor: ${userStats.poor}</div>
                        <div>Blunder: ${userStats.blunder}</div>
                    </div>
                </div>
            </div>

            ${bestMoves.length > 0 ? `
                <div class="best-moves">
                    <h4>⭐ Your Best Moves</h4>
                    ${bestMoves.map(move => `
                        <div class="best-move">
                            <strong>${move.moveNumber}. ${move.notation}</strong> - ${move.evaluation.description}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${blunders.length > 0 ? `
                <div class="worst-moves">
                    <h4>⚠️ Moves to Review</h4>
                    ${blunders.map(move => `
                        <div class="improvement">
                            <strong>${move.moveNumber}. ${move.notation}</strong> - ${move.evaluation.description}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div class="improvements">
                <h4>💡 Tips for Improvement</h4>
                <div class="improvement">
                    <strong>Practice:</strong> Try playing against higher difficulty levels to improve your skills
                </div>
                <div class="improvement">
                    <strong>Analysis:</strong> Review your games to understand your mistakes and learn from them
                </div>
            </div>
        </div>
    `;
}

// Add some additional CSS for the new features
const additionalStyles = `
<style>
.final-analysis-report {
    max-height: 400px;
    overflow-y: auto;
    text-align: left;
}

.final-analysis-report h3 {
    color: #333;
    margin-bottom: 20px;
    text-align: center;
}

.final-analysis-report h4 {
    color: #667eea;
    margin: 20px 0 10px 0;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 5px;
}

.final-analysis-report h5 {
    color: #333;
    margin: 10px 0 5px 0;
}

.game-summary, .player-ratings, .move-breakdown, 
.key-moments, .best-moves, .improvements, .tactical-summary {
    margin-bottom: 20px;
}

.rating-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 15px 0;
}

.player-rating {
    text-align: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 10px;
}

.grade {
    font-size: 2rem;
    font-weight: bold;
    color: #667eea;
    margin: 10px 0;
}

.breakdown-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin: 15px 0;
}

.player-breakdown {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 10px;
}

.stat-list div {
    padding: 5px 0;
    border-bottom: 1px solid #e0e0e0;
}

.key-moment, .best-move, .improvement {
    background: #f8f9fa;
    padding: 10px;
    margin: 10px 0;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.tactical-summary {
    background: #fff3cd;
    padding: 15px;
    border-radius: 10px;
    border-left: 4px solid #ffc107;
}

.captured-pieces-section {
    margin-top: 20px;
}

.captured-pieces-section h5 {
    margin-bottom: 10px;
    color: #666;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.captured-pieces {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    min-height: 30px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 2px dashed #ddd;
}

.captured-piece {
    font-size: 1.2rem;
    padding: 2px 4px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pause-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.pause-content {
    background: white;
    padding: 40px;
    border-radius: 20px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
}

.pause-icon {
    font-size: 4rem;
    color: #667eea;
    margin-bottom: 20px;
}

.pause-content h2 {
    margin-bottom: 10px;
    color: #333;
}

.pause-content p {
    margin-bottom: 30px;
    color: #666;
}

.control-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5 !important;
}

.control-btn:disabled:hover {
    transform: none;
    background: #f8f9fa;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', additionalStyles);