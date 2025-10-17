import React from "react";

export const AppHeaderLogo: React.FC = () => {
  return (
    <div className="flex items-center gap-3">
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/7/7c/NOVO_BRAS%C3%83O_2024_CBMPE.png"
        alt="Corpo de Bombeiro Militar de Pernambuco"
        className="w-24 h-24 object-contain"
      />
      <div>
        <h1 className="text-xl font-bold">Corpo de Bombeiro Militar de Pernambuco</h1>
        <p className="text-sm text-muted-foreground">Portal de Atendimento ao Público</p>
      </div>
    </div>
  );
};