import React from 'react';
import ReactDOM from 'react-dom/client';
import MpesaPaymentWidget from './MpesaPaymentWidget';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MpesaPaymentWidget />
    </React.StrictMode>
);
