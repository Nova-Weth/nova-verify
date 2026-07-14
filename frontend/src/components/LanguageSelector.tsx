import React from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLngs, SupportedLanguage } from '../../i18n';

const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
};

const languageFlags: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  pt: '🇧🇷',
};

interface LanguageSelectorProps {
  className?: string;
  variant?: 'dropdown' | 'buttons';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = '',
  variant = 'dropdown',
}) => {
  const { i18n } = useTranslation();
  const currentLanguage = (i18n.language?.split('-')[0] || 'en') as SupportedLanguage;

  const handleChange = (lng: SupportedLanguage) => {
    i18n.changeLanguage(lng);
  };

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center gap-1 ${className}`} role="group" aria-label="Language selection">
        {supportedLngs.map((lng) => (
          <button
            key={lng}
            onClick={() => handleChange(lng)}
            className={`px-2 py-1 text-sm rounded transition-colors duration-200 ${
              currentLanguage === lng
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            aria-current={currentLanguage === lng ? 'true' : undefined}
            aria-label={languageNames[lng]}
            title={languageNames[lng]}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all duration-200 shadow-sm"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-label={`Current language: ${languageNames[currentLanguage]}`}
      >
        <span className="text-base">{languageFlags[currentLanguage]}</span>
        <span className="hidden sm:inline">{languageNames[currentLanguage]}</span>
        <svg
          className="w-4 h-4 ml-0.5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 opacity-0 pointer-events-none group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
        role="listbox"
        aria-label="Select language"
      >
        {supportedLngs.map((lng) => (
          <button
            key={lng}
            onClick={() => handleChange(lng)}
            className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors duration-150 ${
              currentLanguage === lng
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            role="option"
            aria-selected={currentLanguage === lng}
          >
            <span className="text-lg">{languageFlags[lng]}</span>
            <span>{languageNames[lng]}</span>
            {currentLanguage === lng && (
              <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;
