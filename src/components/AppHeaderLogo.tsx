import React from "react";

export const AppHeaderLogo: React.FC = () => {
  return (
    <div className="flex items-center gap-3">
      <img
        src="https://d1yjjnpx0p53s8.cloudfront.net/styles/logo-thumbnail/s3/0014/4626/brand.gif?itok=gRLiGl3R"
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