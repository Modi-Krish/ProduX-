import { HiMail } from 'react-icons/hi';
import { FaGithub, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="brand-icon">⚡</div>
          <span>Produx</span>
        </div>

        <p className="footer-tagline">Making productivity playful.</p>

        <div className="footer-links">
          <a href="https://github.com/Modi-Krish" target="_blank" rel="noopener noreferrer" className="footer-link" title="GitHub">
            <FaGithub /> <span>Modi-Krish</span>
          </a>
          <a href="https://www.linkedin.com/in/modikrish0311/" target="_blank" rel="noopener noreferrer" className="footer-link" title="LinkedIn">
            <FaLinkedin /> <span>LinkedIn</span>
          </a>
          <a href="mailto:krishmody311@gmail.com" className="footer-link" title="Email">
            <HiMail /> <span>krishmody311@gmail.com</span>
          </a>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Krish Modi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
