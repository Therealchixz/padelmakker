// src/features/matches/ResultModal.jsx
import React, { useState } from 'react';
import PadelMatchResultInput from '../../components/PadelMatchResultInput';

const ResultModal = ({ matchId, onClose }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitResult = async (result) => {
    setSubmitting(true);
    try {
      // Her kan du senere kalde en funktion fra useMatches til at gemme resultatet
      console.log('Resultat indsendt:', result);
      
      // Eksempel på hvordan du kan gemme det (du kan udvide dette senere)
      // await saveMatchResult(matchId, result);
      
      alert('Resultat gemt! (Demo)');
      onClose();
    } catch (error) {
      alert('Fejl ved indsendelse: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[95vh] overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Indsend kampresultat</h2>
          <p className="text-slate-600 text-sm mt-1">Udfyld resultatet for kampen</p>
        </div>

        <div className="p-6">
          <PadelMatchResultInput
            onSubmit={handleSubmitResult}
            onCancel={onClose}
            playersEditable={false}
          />
        </div>

        {submitting && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-3 text-sm text-slate-600">Gemmer resultat...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultModal;
