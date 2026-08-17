CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ClientLocation_Search]
    @Search          NVARCHAR(200) = NULL,
    @ProVestClientId INT           = NULL,
    @LocationId      INT           = NULL,
    @State           VARCHAR(30)   = NULL,
    @IsActive        BIT           = NULL,
    @ProjectSetupId  INT           = NULL,
    @SortBy          VARCHAR(50)   = 'ProVestClientId',
    @SortDir         VARCHAR(4)    = 'ASC',
    @Page            INT           = 1,
    @PageSize        INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 100 SET @PageSize = 100;
    IF @SortDir NOT IN ('ASC','DESC') SET @SortDir = 'ASC';
    IF @SortBy NOT IN ('Id','ProVestClientId','LocationId','State','IsActive')
        SET @SortBy = 'ProVestClientId';

    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    -- LocationId is NOT ProVestClient.Id -- it is the value the importer matches against
    -- Import_Update.client_id / ImportFileHeader.client_id. ClientName is joined for display only.
    SELECT
        l.Id,
        l.ProVestClientId,
        c.ClientName,
        l.LocationId,
        l.State,
        l.IsActive,
        l.ProjectSetupId,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.ProVestClientLocation l
    INNER JOIN dbo.ProVestClient c ON c.Id = l.ProVestClientId
    WHERE (@ProVestClientId IS NULL OR l.ProVestClientId = @ProVestClientId)
      AND (@LocationId      IS NULL OR l.LocationId      = @LocationId)
      AND (@State           IS NULL OR l.State           = @State)
      AND (@IsActive        IS NULL OR l.IsActive        = @IsActive)
      AND (@ProjectSetupId  IS NULL OR l.ProjectSetupId  = @ProjectSetupId)
      AND (@Term IS NULL OR l.State LIKE @Term ESCAPE '\')
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='ProVestClientId' THEN l.ProVestClientId END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ProVestClientId' THEN l.ProVestClientId END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='LocationId'      THEN l.LocationId      END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='LocationId'      THEN l.LocationId      END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='State'           THEN l.State           END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='State'           THEN l.State           END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='IsActive'        THEN l.IsActive        END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='IsActive'        THEN l.IsActive        END DESC,
        CASE WHEN @SortDir='DESC' AND @SortBy='Id'              THEN l.Id              END DESC,
        -- Secondary key for the default sort, then the deterministic tiebreaker.
        CASE WHEN @SortBy='ProVestClientId' THEN l.State END ASC,
        l.Id ASC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
