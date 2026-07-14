import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, CheckCircle, BarChart3, ShoppingBag, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics/ga';
import { FreighterConnect } from '../components/Wallet';
import LanguageSelector from './LanguageSelector';

const Navbar = () => {
  const { t } = useTranslation();

  const handleNavClick = (label: string) => {
    trackEvent({
      action: 'navigation_click',
      category: 'Navbar',
      label,
    });
  };

  return (
    <nav className="bg-white shadow-lg" aria-label="Primary navigation">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" onClick={() => handleNavClick('brand_home')} className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-800">Nova Verify</span>
          </Link>
          
          <div className="flex items-center space-x-6">
            <Link
              to="/"
              onClick={() => handleNavClick('home')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>{t('nav.home')}</span>
            </Link>
            <Link
              to="/issue"
              onClick={() => handleNavClick('issue_proof')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Shield className="h-4 w-4" />
              <span>{t('nav.issueProof')}</span>
            </Link>
            <Link
              to="/verify"
              onClick={() => handleNavClick('verify_proof')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              <span>{t('nav.verifyProof')}</span>
            </Link>
            <Link
              to="/dashboard"
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t('nav.dashboard')}</span>
            </Link>
            <Link
              to="/marketplace"
              onClick={() => handleNavClick('marketplace')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{t('nav.marketplace')}</span>
            </Link>
            <Link
              to="/search"
              onClick={() => handleNavClick('search')}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>{t('nav.search')}</span>
            </Link>

            {/* Language Selector */}
            <div className="border-l border-gray-200 pl-4">
              <LanguageSelector variant="buttons" />
            </div>

            {/* Freighter Wallet Connect Button */}
            <div className="border-l border-gray-200 pl-4">
              <FreighterConnect compact showStatus={false} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
