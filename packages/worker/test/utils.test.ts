import { describe, it, expect } from 'vitest';
import {
    checkPasswordStrength,
    isPasswordValid,
    hashPassword,
    verifyPassword,
    generateId,
    generateShortCode,
    generateToken,
    verifyToken,
    getFileExtension,
    isOfficeFile,
    isImageFile,
    isVideoFile,
    isPdfFile,
    isCodeFile,
} from '../src/utils';

describe('Password utilities', () => {
    describe('checkPasswordStrength', () => {
        it('should return weak for short passwords', () => {
            const result = checkPasswordStrength('abc');
            expect(result.strength).toBe('weak');
            expect(result.feedback).toContain('密码长度至少为 8 个字符');
        });

        it('should return weak for passwords without uppercase', () => {
            const result = checkPasswordStrength('abcdefgh1');
            expect(result.strength).toBe('weak');
            expect(result.feedback).toContain('需要包含大写字母');
        });

        it('should return weak for passwords without lowercase', () => {
            const result = checkPasswordStrength('ABCDEFGH1');
            expect(result.strength).toBe('weak');
            expect(result.feedback).toContain('需要包含小写字母');
        });

        it('should return weak for passwords without numbers', () => {
            const result = checkPasswordStrength('AbcdefgH');
            expect(result.strength).toBe('weak');
            expect(result.feedback).toContain('需要包含数字');
        });

        it('should return medium for passwords meeting basic requirements', () => {
            const result = checkPasswordStrength('Abcdefg1');
            expect(result.strength).toBe('medium');
            expect(result.feedback).toHaveLength(0);
        });

        it('should return strong for complex passwords', () => {
            const result = checkPasswordStrength('Abcdefgh12!@');
            expect(result.strength).toBe('strong');
            expect(result.feedback).toHaveLength(0);
        });
    });

    describe('isPasswordValid', () => {
        it('should return false for weak passwords', () => {
            const result = isPasswordValid('abc');
            expect(result.valid).toBe(false);
        });

        it('should return true for medium strength passwords', () => {
            const result = isPasswordValid('Abcdefg1');
            expect(result.valid).toBe(true);
        });

        it('should return true for strong passwords', () => {
            const result = isPasswordValid('Abcdefgh12!@');
            expect(result.valid).toBe(true);
        });
    });

    describe('hashPassword and verifyPassword', () => {
        it('should hash and verify passwords correctly', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).toContain(':'); // salt:hash format

            const isValid = await verifyPassword(password, hash);
            expect(isValid).toBe(true);

            const isInvalid = await verifyPassword('WrongPassword', hash);
            expect(isInvalid).toBe(false);
        });

        it('should produce different hashes for same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            expect(hash1).not.toBe(hash2); // Different salts
        });
    });
});

describe('ID generation utilities', () => {
    describe('generateId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateId();
            const id2 = generateId();

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
            expect(id1.length).toBe(21);
        });
    });

    describe('generateShortCode', () => {
        it('should generate codes of specified length', () => {
            const code8 = generateShortCode(8);
            const code6 = generateShortCode(6);

            expect(code8.length).toBe(8);
            expect(code6.length).toBe(6);
        });

        it('should generate unique codes', () => {
            const code1 = generateShortCode();
            const code2 = generateShortCode();

            expect(code1).not.toBe(code2);
        });
    });
});

describe('JWT utilities', () => {
    const secret = 'test-secret-key-for-jwt-testing';

    describe('generateToken and verifyToken', () => {
        it('should generate and verify tokens correctly', async () => {
            const payload = { userId: 'user123', role: 'admin' };
            const token = await generateToken(payload, secret);

            expect(token).toBeDefined();
            expect(token.split('.')).toHaveLength(3);

            const verified = await verifyToken(token, secret);
            expect(verified).toBeDefined();
            expect(verified?.userId).toBe('user123');
            expect(verified?.role).toBe('admin');
        });

        it('should fail verification with wrong secret', async () => {
            const payload = { userId: 'user123' };
            const token = await generateToken(payload, secret);

            const verified = await verifyToken(token, 'wrong-secret');
            expect(verified).toBeNull();
        });

        it('should fail verification for expired tokens', async () => {
            const payload = { userId: 'user123' };
            const token = await generateToken(payload, secret, -1); // Already expired

            const verified = await verifyToken(token, secret);
            expect(verified).toBeNull();
        });

        it('should fail verification for malformed tokens', async () => {
            const verified = await verifyToken('invalid-token', secret);
            expect(verified).toBeNull();
        });
    });
});

describe('File type utilities', () => {
    describe('getFileExtension', () => {
        it('should extract file extensions correctly', () => {
            expect(getFileExtension('document.pdf')).toBe('pdf');
            expect(getFileExtension('image.PNG')).toBe('png');
            expect(getFileExtension('file.tar.gz')).toBe('gz');
            expect(getFileExtension('noextension')).toBe('');
        });
    });

    describe('isOfficeFile', () => {
        it('should identify Office files correctly', () => {
            expect(isOfficeFile('document.docx')).toBe(true);
            expect(isOfficeFile('spreadsheet.xlsx')).toBe(true);
            expect(isOfficeFile('presentation.pptx')).toBe(true);
            expect(isOfficeFile('document.doc')).toBe(true);
            expect(isOfficeFile('image.png')).toBe(false);
        });
    });

    describe('isImageFile', () => {
        it('should identify image files correctly', () => {
            expect(isImageFile('photo.jpg')).toBe(true);
            expect(isImageFile('photo.jpeg')).toBe(true);
            expect(isImageFile('image.png')).toBe(true);
            expect(isImageFile('graphic.gif')).toBe(true);
            expect(isImageFile('icon.svg')).toBe(true);
            expect(isImageFile('document.pdf')).toBe(false);
        });
    });

    describe('isVideoFile', () => {
        it('should identify video files correctly', () => {
            expect(isVideoFile('movie.mp4')).toBe(true);
            expect(isVideoFile('clip.webm')).toBe(true);
            expect(isVideoFile('video.mkv')).toBe(true);
            expect(isVideoFile('audio.mp3')).toBe(false);
        });
    });

    describe('isPdfFile', () => {
        it('should identify PDF files correctly', () => {
            expect(isPdfFile('document.pdf')).toBe(true);
            expect(isPdfFile('document.PDF')).toBe(true);
            expect(isPdfFile('document.docx')).toBe(false);
        });
    });

    describe('isCodeFile', () => {
        it('should identify code files correctly', () => {
            expect(isCodeFile('script.js')).toBe(true);
            expect(isCodeFile('component.tsx')).toBe(true);
            expect(isCodeFile('styles.css')).toBe(true);
            expect(isCodeFile('config.json')).toBe(true);
            expect(isCodeFile('image.png')).toBe(false);
        });
    });
});
