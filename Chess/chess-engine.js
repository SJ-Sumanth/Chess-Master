class ChessEngine {
    constructor() {
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.isGameOver = false;
        this.winner = null;
        this.moveCount = 1;
        this.lastMove = null;
        this.kingPositions = { white: [7, 4], black: [0, 4] };
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.enPassantTarget = null;
    }

    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Place pawns
        for (let i = 0; i < 8; i++) {
            board[1][i] = { type: 'pawn', color: 'black' };
            board[6][i] = { type: 'pawn', color: 'white' };
        }
        
        // Place other pieces
        const pieceOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let i = 0; i < 8; i++) {
            board[0][i] = { type: pieceOrder[i], color: 'black' };
            board[7][i] = { type: pieceOrder[i], color: 'white' };
        }
        
        return board;
    }

    getPieceSymbol(piece) {
        if (!piece) return '';
        
        const symbols = {
            white: {
                king: '♔', queen: '♕', rook: '♖',
                bishop: '♗', knight: '♘', pawn: '♙'
            },
            black: {
                king: '♚', queen: '♛', rook: '♜',
                bishop: '♝', knight: '♞', pawn: '♟'
            }
        };
        
        return symbols[piece.color][piece.type];
    }

    isValidSquare(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    getPossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece || piece.color !== this.currentPlayer) return [];

        let moves = [];
        
        switch (piece.type) {
            case 'pawn':
                moves = this.getPawnMoves(row, col);
                break;
            case 'rook':
                moves = this.getRookMoves(row, col);
                break;
            case 'knight':
                moves = this.getKnightMoves(row, col);
                break;
            case 'bishop':
                moves = this.getBishopMoves(row, col);
                break;
            case 'queen':
                moves = this.getQueenMoves(row, col);
                break;
            case 'king':
                moves = this.getKingMoves(row, col);
                break;
        }

        // Filter out moves that would put own king in check
        return moves.filter(move => !this.wouldBeInCheck(row, col, move[0], move[1]));
    }

    getPawnMoves(row, col) {
        const moves = [];
        const piece = this.board[row][col];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        // Forward move
        if (this.isValidSquare(row + direction, col) && !this.board[row + direction][col]) {
            moves.push([row + direction, col]);
            
            // Double move from starting position
            if (row === startRow && !this.board[row + 2 * direction][col]) {
                moves.push([row + 2 * direction, col]);
            }
        }

        // Captures
        for (let dc of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + dc;
            if (this.isValidSquare(newRow, newCol)) {
                const target = this.board[newRow][newCol];
                if (target && target.color !== piece.color) {
                    moves.push([newRow, newCol]);
                }
                // En passant
                if (this.enPassantTarget && 
                    this.enPassantTarget[0] === newRow && 
                    this.enPassantTarget[1] === newCol) {
                    moves.push([newRow, newCol]);
                }
            }
        }

        return moves;
    }

    getRookMoves(row, col) {
        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        
        for (let [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;
                
                if (!this.isValidSquare(newRow, newCol)) break;
                
                const target = this.board[newRow][newCol];
                if (!target) {
                    moves.push([newRow, newCol]);
                } else {
                    if (target.color !== this.board[row][col].color) {
                        moves.push([newRow, newCol]);
                    }
                    break;
                }
            }
        }
        
        return moves;
    }

    getKnightMoves(row, col) {
        const moves = [];
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (let [dr, dc] of knightMoves) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (this.isValidSquare(newRow, newCol)) {
                const target = this.board[newRow][newCol];
                if (!target || target.color !== this.board[row][col].color) {
                    moves.push([newRow, newCol]);
                }
            }
        }
        
        return moves;
    }

    getBishopMoves(row, col) {
        const moves = [];
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        
        for (let [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;
                
                if (!this.isValidSquare(newRow, newCol)) break;
                
                const target = this.board[newRow][newCol];
                if (!target) {
                    moves.push([newRow, newCol]);
                } else {
                    if (target.color !== this.board[row][col].color) {
                        moves.push([newRow, newCol]);
                    }
                    break;
                }
            }
        }
        
        return moves;
    }

    getQueenMoves(row, col) {
        return [...this.getRookMoves(row, col), ...this.getBishopMoves(row, col)];
    }

    getKingMoves(row, col) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (let [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (this.isValidSquare(newRow, newCol)) {
                const target = this.board[newRow][newCol];
                if (!target || target.color !== this.board[row][col].color) {
                    moves.push([newRow, newCol]);
                }
            }
        }

        // Castling
        if (!this.isInCheck(this.currentPlayer)) {
            const castlingMoves = this.getCastlingMoves(row, col);
            moves.push(...castlingMoves);
        }
        
        return moves;
    }

    getCastlingMoves(row, col) {
        const moves = [];
        const color = this.currentPlayer;
        
        // Kingside castling
        if (this.castlingRights[color].kingside) {
            if (!this.board[row][5] && !this.board[row][6]) {
                if (!this.wouldBeInCheck(row, col, row, 5) && 
                    !this.wouldBeInCheck(row, col, row, 6)) {
                    moves.push([row, 6]);
                }
            }
        }
        
        // Queenside castling
        if (this.castlingRights[color].queenside) {
            if (!this.board[row][3] && !this.board[row][2] && !this.board[row][1]) {
                if (!this.wouldBeInCheck(row, col, row, 3) && 
                    !this.wouldBeInCheck(row, col, row, 2)) {
                    moves.push([row, 2]);
                }
            }
        }
        
        return moves;
    }

    isInCheck(color) {
        const kingPos = this.kingPositions[color];
        return this.isSquareAttacked(kingPos[0], kingPos[1], color === 'white' ? 'black' : 'white');
    }

    isSquareAttacked(row, col, byColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === byColor) {
                    const moves = this.getPossibleMovesWithoutCheckValidation(r, c);
                    if (moves.some(move => move[0] === row && move[1] === col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getPossibleMovesWithoutCheckValidation(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        switch (piece.type) {
            case 'pawn':
                return this.getPawnAttacks(row, col);
            case 'rook':
                return this.getRookMoves(row, col);
            case 'knight':
                return this.getKnightMoves(row, col);
            case 'bishop':
                return this.getBishopMoves(row, col);
            case 'queen':
                return this.getQueenMoves(row, col);
            case 'king':
                return this.getKingMovesWithoutCastling(row, col);
            default:
                return [];
        }
    }

    getPawnAttacks(row, col) {
        const moves = [];
        const piece = this.board[row][col];
        const direction = piece.color === 'white' ? -1 : 1;

        for (let dc of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + dc;
            if (this.isValidSquare(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }

        return moves;
    }

    getKingMovesWithoutCastling(row, col) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (let [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (this.isValidSquare(newRow, newCol)) {
                const target = this.board[newRow][newCol];
                if (!target || target.color !== this.board[row][col].color) {
                    moves.push([newRow, newCol]);
                }
            }
        }
        
        return moves;
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        // Make temporary move
        const originalPiece = this.board[toRow][toCol];
        const movingPiece = this.board[fromRow][fromCol];
        
        this.board[toRow][toCol] = movingPiece;
        this.board[fromRow][fromCol] = null;
        
        // Update king position if king moved
        let originalKingPos = null;
        if (movingPiece.type === 'king') {
            originalKingPos = [...this.kingPositions[movingPiece.color]];
            this.kingPositions[movingPiece.color] = [toRow, toCol];
        }
        
        const inCheck = this.isInCheck(movingPiece.color);
        
        // Restore board
        this.board[fromRow][fromCol] = movingPiece;
        this.board[toRow][toCol] = originalPiece;
        
        // Restore king position
        if (originalKingPos) {
            this.kingPositions[movingPiece.color] = originalKingPos;
        }
        
        return inCheck;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // Store move for history
        const move = {
            from: [fromRow, fromCol],
            to: [toRow, toCol],
            piece: piece,
            captured: capturedPiece,
            castling: null,
            enPassant: null,
            promotion: null
        };

        // Handle special moves
        if (piece.type === 'king') {
            // Update king position
            this.kingPositions[piece.color] = [toRow, toCol];
            
            // Handle castling
            if (Math.abs(toCol - fromCol) === 2) {
                const isKingside = toCol > fromCol;
                const rookFromCol = isKingside ? 7 : 0;
                const rookToCol = isKingside ? 5 : 3;
                
                this.board[toRow][rookToCol] = this.board[toRow][rookFromCol];
                this.board[toRow][rookFromCol] = null;
                
                move.castling = isKingside ? 'kingside' : 'queenside';
            }
            
            // Remove castling rights
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }

        // Handle rook moves (affects castling)
        if (piece.type === 'rook') {
            if (fromRow === (piece.color === 'white' ? 7 : 0)) {
                if (fromCol === 0) {
                    this.castlingRights[piece.color].queenside = false;
                } else if (fromCol === 7) {
                    this.castlingRights[piece.color].kingside = false;
                }
            }
        }

        // Handle en passant
        if (piece.type === 'pawn') {
            // En passant capture
            if (this.enPassantTarget && 
                toRow === this.enPassantTarget[0] && 
                toCol === this.enPassantTarget[1]) {
                const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
                const capturedPawn = this.board[capturedPawnRow][toCol];
                this.board[capturedPawnRow][toCol] = null;
                this.capturedPieces[capturedPawn.color].push(capturedPawn);
                move.enPassant = capturedPawn;
            }
            
            // Set en passant target for next move
            if (Math.abs(toRow - fromRow) === 2) {
                this.enPassantTarget = [(fromRow + toRow) / 2, toCol];
            } else {
                this.enPassantTarget = null;
            }
            
            // Pawn promotion
            if ((piece.color === 'white' && toRow === 0) || 
                (piece.color === 'black' && toRow === 7)) {
                piece.type = 'queen'; // Auto-promote to queen
                move.promotion = 'queen';
            }
        } else {
            this.enPassantTarget = null;
        }

        // Make the move
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // Handle captured piece
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
        }

        // Add to history
        this.gameHistory.push(move);
        this.lastMove = { from: [fromRow, fromCol], to: [toRow, toCol] };

        // Switch players
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        if (this.currentPlayer === 'white') {
            this.moveCount++;
        }

        // Check for game over
        this.checkGameOver();

        return move;
    }

    checkGameOver() {
        const hasValidMoves = this.hasValidMoves(this.currentPlayer);
        const inCheck = this.isInCheck(this.currentPlayer);

        if (!hasValidMoves) {
            this.isGameOver = true;
            if (inCheck) {
                this.winner = this.currentPlayer === 'white' ? 'black' : 'white';
            } else {
                this.winner = 'draw';
            }
        }
    }

    hasValidMoves(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const moves = this.getPossibleMoves(row, col);
                    if (moves.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getAllValidMoves(color) {
        const allMoves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const moves = this.getPossibleMoves(row, col);
                    for (let move of moves) {
                        allMoves.push({
                            from: [row, col],
                            to: move,
                            piece: piece
                        });
                    }
                }
            }
        }
        return allMoves;
    }

    evaluatePosition() {
        const pieceValues = {
            pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0
        };

        let score = 0;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    const value = pieceValues[piece.type];
                    score += piece.color === 'white' ? value : -value;
                }
            }
        }

        return score;
    }

    clone() {
        const clone = new ChessEngine();
        clone.board = this.board.map(row => row.map(piece => piece ? {...piece} : null));
        clone.currentPlayer = this.currentPlayer;
        clone.gameHistory = [...this.gameHistory];
        clone.capturedPieces = {
            white: [...this.capturedPieces.white],
            black: [...this.capturedPieces.black]
        };
        clone.isGameOver = this.isGameOver;
        clone.winner = this.winner;
        clone.moveCount = this.moveCount;
        clone.lastMove = this.lastMove ? {...this.lastMove} : null;
        clone.kingPositions = {
            white: [...this.kingPositions.white],
            black: [...this.kingPositions.black]
        };
        clone.castlingRights = {
            white: {...this.castlingRights.white},
            black: {...this.castlingRights.black}
        };
        clone.enPassantTarget = this.enPassantTarget ? [...this.enPassantTarget] : null;
        
        return clone;
    }
}