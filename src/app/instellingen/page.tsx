import { getDataDirSettings } from './actions';
import SettingsForm from './SettingsForm';

export const metadata = {
    title: 'Instellingen | Waardebepaling OEV',
    description: 'Configureer de data map voor lokale of OneDrive opslag.',
};

export default async function InstellingenPage() {
    const settings = await getDataDirSettings();

    return (
        <main className="page-container">
            <div className="page-header">
                <h1>Instellingen</h1>
                <p className="page-subtitle">
                    Configureer waar de app zijn data opslaat — lokaal of via OneDrive.
                </p>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2>📁 Data map</h2>
                    <p>
                        Standaard slaat de app data op in de <code>data/</code> map naast de applicatie.
                        Op een werk-pc met gedeelde OneDrive kun je hier een ander pad instellen.
                    </p>
                </div>
                <SettingsForm
                    currentDataDir={settings.currentDataDir}
                    settingsFile={settings.settingsFile}
                    isDefault={settings.isDefault}
                />
            </div>
        </main>
    );
}
