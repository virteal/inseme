import { Github, Facebook, Mail, User } from 'lucide-react'

export default function Login({ onSignInAnonymously, onSignInWithProvider }) {
    return (
        <div className="flex flex-col items-center justify-center space-y-8 h-full">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">Participez à distance</h2>
                <p className="text-gray-500">Choisissez une méthode de connexion pour rejoindre l'assemblée</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm">
                <button
                    onClick={onSignInAnonymously}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    <User size={20} />
                    <span>Anonyme</span>
                </button>

                <button
                    onClick={() => onSignInWithProvider('github')}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                    <Github size={20} />
                    <span>Github</span>
                </button>

                <button
                    onClick={() => onSignInWithProvider('google')}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    <Mail size={20} />
                    <span>Google</span>
                </button>

                <button
                    onClick={() => onSignInWithProvider('facebook')}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Facebook size={20} />
                    <span>Facebook</span>
                </button>
            </div>

            <div className="w-full max-w-lg mt-8">
                <div className="relative pt-[56.25%] bg-black rounded-xl overflow-hidden shadow-lg">
                    <iframe
                        className="absolute top-0 left-0 w-full h-full"
                        src="https://www.youtube.com/embed/04Z6X4iaZrc"
                        title="Video Présentation"
                        frameBorder="0"
                        allowFullScreen
                    ></iframe>
                </div>
            </div>
        </div>
    )
}
