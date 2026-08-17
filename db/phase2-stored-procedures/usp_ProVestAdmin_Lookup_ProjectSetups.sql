-- Dropdown source for the nullable ProjectSetupId FK on ProVestClient and
-- ProVestClientLocation. ProjectSetup has no name of its own -- the readable
-- label comes from the joined Project.
CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Lookup_ProjectSetups]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ps.Id,
        ps.ProjectId,
        p.Name AS ProjectName,
        ps.DepartmentId,
        ps.SubDepartmentId,
        ps.IsActive
    FROM dbo.ProjectSetup ps
    INNER JOIN dbo.Project p ON p.Id = ps.ProjectId
    WHERE ps.IsDeleted = 0
    ORDER BY p.Name, ps.Id;
END
