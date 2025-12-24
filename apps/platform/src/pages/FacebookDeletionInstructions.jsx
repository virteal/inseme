import React from "react";

export default function FacebookDeletionInstructions() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="page-title">Instructions pour la suppression des données (Facebook)</h1>
      <p className="mt-4">
        Si vous souhaitez demander la suppression des données que nous conservons liées à votre
        compte Facebook, suivez ces étapes :
      </p>
      <ol className="mt-3 list-decimal list-inside">
        <li>
          Connectez-vous à votre compte Facebook et utilisez l'outil de confidentialité pour
          demander la suppression des données de l'application.
        </li>
        <li className="mt-2">
          Facebook déclenchera alors une requête envoyée à notre service de suppression. Nous
          générerons un code de confirmation et mettrons à jour le statut de la demande.
        </li>
        <li className="mt-2">
          Pour vérifier le statut de votre demande, ouvrez la page de statut et ajoutez le code reçu
          de Facebook en paramètre `code` :
          <br />
          <a href="/oauth/facebook/deletion-status" className="text-primary underline">
            /oauth/facebook/deletion-status
          </a>
          (ex. <em>/oauth/facebook/deletion-status?code=VOTRE_CODE</em>)
        </li>
      </ol>

      <p className="mt-4">
        Si vous ne recevez pas de code ou si vous avez besoin d'assistance, contactez-nous à
        <a href="mailto:jean_hugues_robert@yahoo.com" className="ml-1 text-primary underline">
          jean_hugues_robert@yahoo.com
        </a>
        .
      </p>
    </div>
  );
}
