import { PageHeader } from '../components/Ui';
import { useDatabase } from '../state/DatabaseContext';

export function HistoryPage() {
  const { commits } = useDatabase();

  return (
    <div className="history">
      <PageHeader>History</PageHeader>
      <table className="sk-grid">
        <thead>
          <tr>
            <th>Action</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {[...commits].reverse().map((commit, index) => (
            <tr key={`${commit.timestamp}-${index}`}>
              <td className="action">{commit.message}</td>
              <td className="timestamp">
                {new Date(commit.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
