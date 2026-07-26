import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders the header correctly', () => {
    render(<App />);
    expect(screen.getByText(/Invoice Generator/i)).toBeTruthy();
    expect(screen.getByText(/Professional Billing Solution/i)).toBeTruthy();
  });

  it('toggles dark mode when button is clicked', () => {
    const { container } = render(<App />);
    const themeButton = screen.getByTitle('Toggle Dark Mode');
    
    // Default or current theme from localStorage might be light or dark
    const initialTheme = document.documentElement.getAttribute('data-theme');
    
    fireEvent.click(themeButton);
    
    const newTheme = document.documentElement.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });
  
  it('shows validation error when attempting to generate empty invoice', async () => {
    render(<App />);
    const downloadBtn = screen.getByText('Download');
    fireEvent.click(downloadBtn);
    
    // Should show a toast message
    expect(await screen.findByText(/Please add at least one item/i)).toBeTruthy();
  });
});
