export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { formData, entityType } = req.body;

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return res.status(500).json({ error: 'Zoho credentials not configured' });
    }

    // Get access token
    const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }).toString()
    });

    if (!tokenResponse.ok) {
      return res.status(500).json({ error: 'Failed to get Zoho access token' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Format services
    const serviceMap = {
      oil_change: 'Oil Change',
      brakes: 'Brake Service',
      detailing: 'Auto Detailing',
      preventive_maintenance: 'Preventive Maintenance',
      battery_services: 'Battery Services',
      multi_point_inspection: 'Multi-Point Inspection'
    };
    const services = (formData.service_type || []).map(t => serviceMap[t] || t).join(', ');

    // Build lead data based on entity type
    let leadData = {
      Phone: formData.phone,
      Email: formData.email || ''
    };

    if (entityType === 'ServiceInquiry') {
      leadData.First_Name = formData.first_name || 'Customer';
      leadData.Last_Name = formData.last_name || 'Inquiry';
      leadData.Description = `Vehicle: ${formData.vehicle_info || 'Not specified'}\n\nServices: ${services}\n\nMessage: ${formData.message || 'No additional message'}`;
    } else if (entityType === 'FleetInquiry') {
      leadData.Last_Name = formData.business_name;
      leadData.Description = `Fleet Info: ${formData.fleet_info}\n\nServices: ${services}\n\nAdditional Details: ${formData.additional_details || ''}`;
    }

    // Create lead in Zoho CRM
    const crmResponse = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [leadData]
      })
    });

    if (!crmResponse.ok) {
      const errorText = await crmResponse.text();
      console.error('Zoho CRM error:', errorText);
      return res.status(500).json({ error: 'Failed to create lead in Zoho CRM' });
    }

    const crmData = await crmResponse.json();
    return res.status(200).json({ success: true, data: crmData });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
