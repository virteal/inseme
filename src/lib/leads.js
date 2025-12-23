
export async function submitLead(data) {
    // In a real app, this would send data to a backend or Supabase table
    console.log('Lead submitted:', data);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return success
    return { success: true };
}
